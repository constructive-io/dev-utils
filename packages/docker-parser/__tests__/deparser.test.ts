import { deparse } from '../src/deparser';
import { parse } from '../src/parser';

describe('docker-deparser', () => {
  describe('deparse', () => {
    it('should deparse FROM instruction', () => {
      const ast = parse('FROM node:18-alpine');
      const result = deparse(ast);
      expect(result).toBe('FROM node:18-alpine');
    });

    it('should deparse FROM with AS alias', () => {
      const ast = parse('FROM node:18 AS builder');
      const result = deparse(ast);
      expect(result).toBe('FROM node:18 AS builder');
    });

    it('should deparse FROM with platform', () => {
      const ast = parse('FROM --platform=linux/amd64 node:18');
      const result = deparse(ast);
      expect(result).toBe('FROM --platform=linux/amd64 node:18');
    });

    it('should deparse RUN instruction (shell form)', () => {
      const ast = parse('FROM alpine\nRUN echo hello');
      const result = deparse(ast);
      expect(result).toContain('RUN echo hello');
    });

    it('should deparse RUN instruction (exec form)', () => {
      const ast = parse('FROM alpine\nRUN ["echo", "hello"]');
      const result = deparse(ast);
      expect(result).toContain('RUN ["echo","hello"]');
    });

    it('should deparse COPY instruction', () => {
      const ast = parse('FROM alpine\nCOPY src/ dest/');
      const result = deparse(ast);
      expect(result).toContain('COPY src/ dest/');
    });

    it('should deparse COPY with --from flag', () => {
      const ast = parse('FROM alpine\nCOPY --from=builder /app /app');
      const result = deparse(ast);
      expect(result).toContain('COPY --from=builder /app /app');
    });

    it('should deparse ENV instruction', () => {
      const ast = parse('FROM alpine\nENV NODE_ENV=production');
      const result = deparse(ast);
      expect(result).toContain('ENV NODE_ENV=production');
    });

    it('should deparse ARG instruction', () => {
      const ast = parse('FROM alpine\nARG VERSION=1.0.0');
      const result = deparse(ast);
      expect(result).toContain('ARG VERSION=1.0.0');
    });

    it('should deparse WORKDIR instruction', () => {
      const ast = parse('FROM alpine\nWORKDIR /app');
      const result = deparse(ast);
      expect(result).toContain('WORKDIR /app');
    });

    it('should deparse USER instruction', () => {
      const ast = parse('FROM alpine\nUSER node:node');
      const result = deparse(ast);
      expect(result).toContain('USER node:node');
    });

    it('should deparse EXPOSE instruction', () => {
      const ast = parse('FROM alpine\nEXPOSE 80 443/tcp');
      const result = deparse(ast);
      expect(result).toContain('EXPOSE 80 443/tcp');
    });

    it('should deparse VOLUME instruction', () => {
      const ast = parse('FROM alpine\nVOLUME /data');
      const result = deparse(ast);
      expect(result).toContain('VOLUME /data');
    });

    it('should deparse LABEL instruction', () => {
      const ast = parse('FROM alpine\nLABEL version=1.0');
      const result = deparse(ast);
      expect(result).toContain('LABEL version=1.0');
    });

    it('should deparse CMD instruction', () => {
      const ast = parse('FROM alpine\nCMD ["node", "server.js"]');
      const result = deparse(ast);
      expect(result).toContain('CMD ["node","server.js"]');
    });

    it('should deparse ENTRYPOINT instruction', () => {
      const ast = parse('FROM alpine\nENTRYPOINT ["python", "app.py"]');
      const result = deparse(ast);
      expect(result).toContain('ENTRYPOINT ["python","app.py"]');
    });

    it('should deparse SHELL instruction', () => {
      const ast = parse('FROM alpine\nSHELL ["/bin/bash", "-c"]');
      const result = deparse(ast);
      expect(result).toContain('SHELL ["/bin/bash","-c"]');
    });

    it('should deparse HEALTHCHECK instruction', () => {
      const ast = parse('FROM alpine\nHEALTHCHECK --interval=30s CMD ["curl", "-f", "http://localhost/"]');
      const result = deparse(ast);
      expect(result).toContain('HEALTHCHECK --interval=30s CMD ["curl","-f","http://localhost/"]');
    });

    it('should deparse HEALTHCHECK NONE', () => {
      const ast = parse('FROM alpine\nHEALTHCHECK NONE');
      const result = deparse(ast);
      expect(result).toContain('HEALTHCHECK NONE');
    });

    it('should deparse STOPSIGNAL instruction', () => {
      const ast = parse('FROM alpine\nSTOPSIGNAL SIGTERM');
      const result = deparse(ast);
      expect(result).toContain('STOPSIGNAL SIGTERM');
    });

    it('should deparse multi-stage build', () => {
      const source = `FROM node:18 AS builder
WORKDIR /app

FROM node:18-alpine
COPY --from=builder /app /app`;

      const ast = parse(source);
      const result = deparse(ast);

      expect(result).toContain('FROM node:18 AS builder');
      expect(result).toContain('FROM node:18-alpine');
      expect(result).toContain('COPY --from=builder /app /app');
    });

    it('should deparse parser directives', () => {
      const source = `# escape=\`
FROM alpine`;

      const ast = parse(source);
      const result = deparse(ast);

      expect(result).toContain('# escape=`');
    });
  });
});
