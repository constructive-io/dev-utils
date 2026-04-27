import { parse } from '../src/parser';
import { CopyInstruction, RunInstruction } from '../src/types';

describe('docker-parser', () => {
  describe('parse', () => {
    it('should parse a simple FROM instruction', () => {
      const source = 'FROM node:18-alpine';
      const ast = parse(source);

      expect(ast.type).toBe('Dockerfile');
      expect(ast.stages).toHaveLength(1);
      expect(ast.stages[0].from.image).toBe('node');
      expect(ast.stages[0].from.tag).toBe('18-alpine');
    });

    it('should parse FROM with AS alias', () => {
      const source = 'FROM node:18 AS builder';
      const ast = parse(source);

      expect(ast.stages[0].from.name).toBe('builder');
    });

    it('should parse FROM with platform', () => {
      const source = 'FROM --platform=linux/amd64 node:18';
      const ast = parse(source);

      expect(ast.stages[0].from.platform).toBe('linux/amd64');
    });

    it('should parse FROM with digest', () => {
      const source = 'FROM node@sha256:abc123';
      const ast = parse(source);

      expect(ast.stages[0].from.image).toBe('node');
      expect(ast.stages[0].from.digest).toBe('sha256:abc123');
    });

    it('should parse RUN instruction (shell form)', () => {
      const source = 'FROM alpine\nRUN echo hello';
      const ast = parse(source);

      const run = ast.stages[0].instructions[0] as RunInstruction;
      expect(run.type).toBe('RunInstruction');
      expect(run.command).toBe('echo hello');
      expect(run.isExec).toBe(false);
    });

    it('should parse RUN instruction (exec form)', () => {
      const source = 'FROM alpine\nRUN ["echo", "hello"]';
      const ast = parse(source);

      const run = ast.stages[0].instructions[0] as RunInstruction;
      expect(run.type).toBe('RunInstruction');
      expect(run.command).toEqual(['echo', 'hello']);
      expect(run.isExec).toBe(true);
    });

    it('should parse COPY instruction', () => {
      const source = 'FROM alpine\nCOPY src/ dest/';
      const ast = parse(source);

      const copy = ast.stages[0].instructions[0] as CopyInstruction;
      expect(copy.type).toBe('CopyInstruction');
      expect(copy.sources).toEqual(['src/']);
      expect(copy.destination).toBe('dest/');
    });

    it('should parse COPY with --from flag', () => {
      const source = 'FROM alpine\nCOPY --from=builder /app /app';
      const ast = parse(source);

      const copy = ast.stages[0].instructions[0] as CopyInstruction;
      expect(copy.from).toBe('builder');
    });

    it('should parse ENV instruction', () => {
      const source = 'FROM alpine\nENV NODE_ENV=production';
      const ast = parse(source);

      const env = ast.stages[0].instructions[0];
      expect(env.type).toBe('EnvInstruction');
      if (env.type === 'EnvInstruction') {
        expect(env.variables).toEqual([{ key: 'NODE_ENV', value: 'production' }]);
      }
    });

    it('should parse ARG instruction', () => {
      const source = 'FROM alpine\nARG VERSION=1.0.0';
      const ast = parse(source);

      const arg = ast.stages[0].instructions[0];
      expect(arg.type).toBe('ArgInstruction');
      if (arg.type === 'ArgInstruction') {
        expect(arg.name).toBe('VERSION');
        expect(arg.defaultValue).toBe('1.0.0');
      }
    });

    it('should parse WORKDIR instruction', () => {
      const source = 'FROM alpine\nWORKDIR /app';
      const ast = parse(source);

      const workdir = ast.stages[0].instructions[0];
      expect(workdir.type).toBe('WorkdirInstruction');
      if (workdir.type === 'WorkdirInstruction') {
        expect(workdir.path).toBe('/app');
      }
    });

    it('should parse USER instruction', () => {
      const source = 'FROM alpine\nUSER node:node';
      const ast = parse(source);

      const user = ast.stages[0].instructions[0];
      expect(user.type).toBe('UserInstruction');
      if (user.type === 'UserInstruction') {
        expect(user.user).toBe('node');
        expect(user.group).toBe('node');
      }
    });

    it('should parse EXPOSE instruction', () => {
      const source = 'FROM alpine\nEXPOSE 80 443/tcp';
      const ast = parse(source);

      const expose = ast.stages[0].instructions[0];
      expect(expose.type).toBe('ExposeInstruction');
      if (expose.type === 'ExposeInstruction') {
        expect(expose.ports).toHaveLength(2);
        expect(expose.ports[0].port).toBe('80');
        expect(expose.ports[1].port).toBe('443');
        expect(expose.ports[1].protocol).toBe('tcp');
      }
    });

    it('should parse VOLUME instruction', () => {
      const source = 'FROM alpine\nVOLUME /data';
      const ast = parse(source);

      const volume = ast.stages[0].instructions[0];
      expect(volume.type).toBe('VolumeInstruction');
      if (volume.type === 'VolumeInstruction') {
        expect(volume.paths).toEqual(['/data']);
      }
    });

    it('should parse LABEL instruction', () => {
      const source = 'FROM alpine\nLABEL version=1.0';
      const ast = parse(source);

      const label = ast.stages[0].instructions[0];
      expect(label.type).toBe('LabelInstruction');
      if (label.type === 'LabelInstruction') {
        expect(label.labels).toEqual([{ key: 'version', value: '1.0' }]);
      }
    });

    it('should parse CMD instruction', () => {
      const source = 'FROM alpine\nCMD ["node", "server.js"]';
      const ast = parse(source);

      const cmd = ast.stages[0].instructions[0];
      expect(cmd.type).toBe('CmdInstruction');
      if (cmd.type === 'CmdInstruction') {
        expect(cmd.command).toEqual(['node', 'server.js']);
        expect(cmd.isExec).toBe(true);
      }
    });

    it('should parse ENTRYPOINT instruction', () => {
      const source = 'FROM alpine\nENTRYPOINT ["python", "app.py"]';
      const ast = parse(source);

      const entrypoint = ast.stages[0].instructions[0];
      expect(entrypoint.type).toBe('EntrypointInstruction');
      if (entrypoint.type === 'EntrypointInstruction') {
        expect(entrypoint.command).toEqual(['python', 'app.py']);
        expect(entrypoint.isExec).toBe(true);
      }
    });

    it('should parse SHELL instruction', () => {
      const source = 'FROM alpine\nSHELL ["/bin/bash", "-c"]';
      const ast = parse(source);

      const shell = ast.stages[0].instructions[0];
      expect(shell.type).toBe('ShellInstruction');
      if (shell.type === 'ShellInstruction') {
        expect(shell.shell).toEqual(['/bin/bash', '-c']);
      }
    });

    it('should parse HEALTHCHECK instruction', () => {
      const source = 'FROM alpine\nHEALTHCHECK --interval=30s CMD ["curl", "-f", "http://localhost/"]';
      const ast = parse(source);

      const healthcheck = ast.stages[0].instructions[0];
      expect(healthcheck.type).toBe('HealthcheckInstruction');
      if (healthcheck.type === 'HealthcheckInstruction') {
        expect(healthcheck.interval).toBe('30s');
        expect(healthcheck.command?.command).toEqual(['curl', '-f', 'http://localhost/']);
      }
    });

    it('should parse HEALTHCHECK NONE', () => {
      const source = 'FROM alpine\nHEALTHCHECK NONE';
      const ast = parse(source);

      const healthcheck = ast.stages[0].instructions[0];
      expect(healthcheck.type).toBe('HealthcheckInstruction');
      if (healthcheck.type === 'HealthcheckInstruction') {
        expect(healthcheck.none).toBe(true);
      }
    });

    it('should parse STOPSIGNAL instruction', () => {
      const source = 'FROM alpine\nSTOPSIGNAL SIGTERM';
      const ast = parse(source);

      const stopsignal = ast.stages[0].instructions[0];
      expect(stopsignal.type).toBe('StopsignalInstruction');
      if (stopsignal.type === 'StopsignalInstruction') {
        expect(stopsignal.signal).toBe('SIGTERM');
      }
    });

    it('should parse multi-stage build', () => {
      const source = `FROM node:18 AS builder
WORKDIR /app
RUN npm install

FROM node:18-alpine
COPY --from=builder /app /app
CMD ["node", "index.js"]`;

      const ast = parse(source);

      expect(ast.stages).toHaveLength(2);
      expect(ast.stages[0].from.name).toBe('builder');
      expect(ast.stages[1].from.tag).toBe('18-alpine');
    });

    it('should parse parser directives', () => {
      const source = `# escape=\`
FROM alpine
RUN echo hello`;

      const ast = parse(source);

      expect(ast.directives).toHaveLength(1);
      expect(ast.directives[0].directive).toBe('escape');
      expect(ast.directives[0].value).toBe('`');
    });

    it('should include bashAst for shell-form RUN instructions (heterogeneous parsing)', () => {
      const source = 'FROM alpine\nRUN echo hello && npm install';
      const ast = parse(source);

      const run = ast.stages[0].instructions[0] as RunInstruction;
      expect(run.type).toBe('RunInstruction');
      expect(run.isExec).toBe(false);
      expect(run.bashAst).toBeDefined();
      expect((run.bashAst as { type: string }).type).toBe('Script');
    });

    it('should not include bashAst for exec-form RUN instructions', () => {
      const source = 'FROM alpine\nRUN ["echo", "hello"]';
      const ast = parse(source);

      const run = ast.stages[0].instructions[0] as RunInstruction;
      expect(run.type).toBe('RunInstruction');
      expect(run.isExec).toBe(true);
      expect(run.bashAst).toBeUndefined();
    });
  });
});
