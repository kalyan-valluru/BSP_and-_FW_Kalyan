"""Deterministic image preprocessing for schematic/document OCR.

This module never infers hardware facts. It only improves image quality before OCR/Vision.
"""
from __future__ import annotations

import math
import os
import sys

try:
    import cv2
    import numpy as np
except ImportError:  # optional dependency
    cv2 = None
    np = None


def _deskew(gray):
    if cv2 is None or np is None:
        return gray, 0.0
    try:
        _, threshold = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        ys, xs = np.where(threshold > 0)
        if len(xs) < 100:
            return gray, 0.0
        coords = np.column_stack((xs, ys)).astype(np.float32)
        angle = float(cv2.minAreaRect(coords)[-1])
        angle = -(90 + angle) if angle < -45 else -angle
        if not math.isfinite(angle) or abs(angle) < 0.5 or abs(angle) > 12:
            return gray, 0.0
        h, w = gray.shape[:2]
        matrix = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), angle, 1.0)
        return cv2.warpAffine(gray, matrix, (w, h), flags=cv2.INTER_CUBIC,
                              borderMode=cv2.BORDER_CONSTANT, borderValue=255), angle
    except Exception as exc:
        sys.stderr.write(f"[PREPROCESS] Deskew skipped: {exc}\n")
        return gray, 0.0


def preprocess_image(input_path: str, output_path: str, max_dimension: int = 6000):
    """Create an OCR-friendly derivative; return path and deterministic metadata."""
    if cv2 is None or np is None:
        return input_path, {"applied": False, "reason": "opencv_unavailable"}
    image = cv2.imread(input_path, cv2.IMREAD_COLOR)
    if image is None:
        return input_path, {"applied": False, "reason": "image_decode_failed"}

    original_h, original_w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    min_dimension = min(gray.shape[:2])
    if min_dimension < 1800:
        scale = min(3.0, 1800.0 / max(1.0, float(min_dimension)))
        new_w = min(max_dimension, max(1, int(round(gray.shape[1] * scale))))
        new_h = min(max_dimension, max(1, int(round(gray.shape[0] * scale))))
        gray = cv2.resize(gray, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    elif max(gray.shape[:2]) > max_dimension:
        scale = max_dimension / float(max(gray.shape[:2]))
        gray = cv2.resize(gray, (int(gray.shape[1] * scale), int(gray.shape[0] * scale)),
                          interpolation=cv2.INTER_AREA)

    gray, angle = _deskew(gray)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    enhanced = cv2.fastNlMeansDenoising(enhanced, None, 5, 7, 21)

    parent = os.path.dirname(output_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    if not cv2.imwrite(output_path, enhanced):
        return input_path, {"applied": False, "reason": "write_failed"}

    return output_path, {
        "applied": True,
        "originalWidth": original_w,
        "originalHeight": original_h,
        "outputWidth": int(enhanced.shape[1]),
        "outputHeight": int(enhanced.shape[0]),
        "deskewDegrees": round(angle, 3),
        "operations": ["grayscale", "resolution_normalization", "deskew", "clahe", "light_denoise"],
        "source": "deterministic_opencv"
    }
