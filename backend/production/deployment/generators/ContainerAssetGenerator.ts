import { ContainerAssetSpec, KubernetesSpec } from '../types/deploymentTypes';

export class ContainerAssetGenerator {
  public generateContainerAssets(): ContainerAssetSpec {
    return {
      dockerfileContent: `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000 5173
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:5000/api/health || exit 1
CMD ["npm", "start"]`,
      dockerComposeContent: `version: '3.8'
services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    restart: always`,
      healthcheckScript: `#!/bin/sh
curl -f http://localhost:5000/api/health || exit 1`
    };
  }
}

export class KubernetesManifestGenerator {
  public generateKubernetesManifests(): KubernetesSpec {
    return {
      deploymentYaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: genai-eda-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: genai-eda-backend
  template:
    metadata:
      labels:
        app: genai-eda-backend
    spec:
      containers:
      - name: backend
        image: eda-backend:v2.1
        ports:
        - containerPort: 5000`,
      serviceYaml: `apiVersion: v1
kind: Service
metadata:
  name: genai-eda-service
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 5000`,
      ingressYaml: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: genai-eda-ingress
spec:
  rules:
  - host: eda.enterprise.domain`,
      hpaYaml: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: genai-eda-hpa
spec:
  minReplicas: 2
  maxReplicas: 10`
    };
  }
}
