import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';

export const enterpriseRouter = Router();

const PROJECTS_DIR = path.join(process.cwd(), 'workspace', 'generated', 'projects');

// Utility to read file safely
async function readFileSafely(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

// 1. Get build and project history
enterpriseRouter.get('/builds', async (req: Request, res: Response) => {
  try {
    const builds: any[] = [];
    let dirs: string[] = [];
    try {
      dirs = await fs.readdir(PROJECTS_DIR);
    } catch {
      // directory does not exist yet (no builds run)
      res.json([]);
      return;
    }

    for (const dir of dirs) {
      const fullPath = path.join(PROJECTS_DIR, dir);
      const stat = await fs.stat(fullPath);
      if (!stat.isDirectory()) continue;

      const summaryPath = path.join(fullPath, 'reports', 'build_summary.json');
      const manifestPath = path.join(fullPath, 'firmware', 'project_manifest.json');
      
      let summaryData: any = {};
      try {
        const content = await fs.readFile(summaryPath, 'utf-8');
        summaryData = JSON.parse(content);
      } catch {
        // No summary report - build might be incomplete or failed
      }

      let manifestData: any = {};
      try {
        const content = await fs.readFile(manifestPath, 'utf-8');
        manifestData = JSON.parse(content);
      } catch {}

      const platform = summaryData.platform || (dir.includes('stm32') ? 'stm32' : 'xilinx');
      const buildStatus = summaryData.elfReport?.valid || manifestData.buildStatus === 'SUCCESS' ? 'SUCCESS' : 'FAILURE';

      builds.push({
        sessionId: dir,
        timestamp: stat.mtime.toISOString(),
        platform,
        status: buildStatus,
        processor: summaryData.processor || manifestData.processor || 'Unknown',
        architecture: summaryData.architecture || manifestData.architecture || 'Unknown',
        toolchain: summaryData.toolchain || manifestData.toolchain || 'Unknown',
        elfSizeKb: summaryData.elfReport?.sizeBytes ? parseFloat((summaryData.elfReport.sizeBytes / 1024).toFixed(2)) : undefined,
        warningsCount: (summaryData.warnings?.length || 0) + (summaryData.elfReport?.warnings?.length || 0),
        errorsCount: (summaryData.errors?.length || 0) + (summaryData.elfReport?.errors?.length || 0),
        summary: summaryData,
        manifest: manifestData
      });
    }

    // Sort latest builds first
    builds.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(builds);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Project Explorer - read files tree recursively
async function buildFileTree(dir: string, base: string = ''): Promise<any[]> {
  const list = await fs.readdir(dir, { withFileTypes: true });
  const nodes: any[] = [];
  
  for (const item of list) {
    const relPath = path.join(base, item.name);
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      nodes.push({
        name: item.name,
        path: relPath.replace(/\\/g, '/'),
        type: 'directory',
        children: await buildFileTree(fullPath, relPath)
      });
    } else {
      const stat = await fs.stat(fullPath);
      nodes.push({
        name: item.name,
        path: relPath.replace(/\\/g, '/'),
        type: 'file',
        sizeBytes: stat.size
      });
    }
  }
  return nodes;
}

enterpriseRouter.get('/explore/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const projectPath = path.join(PROJECTS_DIR, sessionId);
  try {
    await fs.access(projectPath);
    const tree = await buildFileTree(projectPath);
    res.json(tree);
  } catch (err: any) {
    res.status(404).json({ error: `Session workspace ${sessionId} not found: ${err.message}` });
  }
});

// 3. Read specific file contents for Project Explorer preview
enterpriseRouter.get('/file/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const relPath = req.query.path;
  if (typeof relPath !== 'string') {
    res.status(400).json({ error: 'Query parameter "path" is required' });
    return;
  }
  const filePath = path.join(PROJECTS_DIR, sessionId, relPath);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content });
  } catch (err: any) {
    res.status(404).json({ error: `File not found: ${relPath}` });
  }
});

// 4. Artifact Comparison
enterpriseRouter.get('/compare', async (req: Request, res: Response) => {
  const { sessionA, sessionB } = req.query;
  if (typeof sessionA !== 'string' || typeof sessionB !== 'string') {
    res.status(400).json({ error: 'Parameters sessionA and sessionB are required' });
    return;
  }

  const pathA = path.join(PROJECTS_DIR, sessionA);
  const pathB = path.join(PROJECTS_DIR, sessionB);

  try {
    const codeA = await readFileSafely(path.join(pathA, 'source', 'main.c')) || '';
    const codeB = await readFileSafely(path.join(pathB, 'source', 'main.c')) || '';

    const summaryA = JSON.parse(await readFileSafely(path.join(pathA, 'reports', 'build_summary.json')) || '{}');
    const summaryB = JSON.parse(await readFileSafely(path.join(pathB, 'reports', 'build_summary.json')) || '{}');

    res.json({
      builds: {
        a: { sessionId: sessionA, platform: summaryA.platform, timestamp: summaryA.timestamp },
        b: { sessionId: sessionB, platform: summaryB.platform, timestamp: summaryB.timestamp }
      },
      elfMetrics: {
        a: summaryA.elfReport || {},
        b: summaryB.elfReport || {},
        sizeDiffBytes: (summaryA.elfReport?.sizeBytes || 0) - (summaryB.elfReport?.sizeBytes || 0)
      },
      code: {
        a: codeA,
        b: codeB,
        identical: codeA === codeB
      },
      bsp: {
        a: summaryA.bspReport || {},
        b: summaryB.bspReport || {}
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. ZIP Workspaces Exporter
enterpriseRouter.get('/export/:sessionId/zip', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const projectPath = path.join(PROJECTS_DIR, sessionId);
  try {
    await fs.access(projectPath);
    const zip = new AdmZip();
    zip.addLocalFolder(projectPath);
    const buffer = zip.toBuffer();
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=project_workspace_${sessionId}.zip`);
    res.send(buffer);
  } catch (err: any) {
    res.status(404).json({ error: `Project workspace ${sessionId} not found: ${err.message}` });
  }
});
