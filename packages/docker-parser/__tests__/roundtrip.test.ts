import { cleanTree } from '../src/clean';
import { deparse } from '../src/deparser';
import { parse } from '../src/parser';

describe('docker-parser round-trip', () => {
  /**
   * Round-trip test helper: parse -> deparse -> parse -> compare cleaned ASTs
   */
  function expectRoundTrip(source: string): void {
    const ast1 = parse(source);
    const deparsed = deparse(ast1);
    const ast2 = parse(deparsed);

    const clean1 = cleanTree(ast1);
    const clean2 = cleanTree(ast2);

    expect(clean2).toEqual(clean1);
  }

  describe('basic instructions', () => {
    it('should round-trip FROM instruction', () => {
      expectRoundTrip('FROM node:18-alpine');
    });

    it('should round-trip FROM with AS alias', () => {
      expectRoundTrip('FROM node:18 AS builder');
    });

    it('should round-trip FROM with platform', () => {
      expectRoundTrip('FROM --platform=linux/amd64 node:18');
    });

    it('should round-trip FROM with digest', () => {
      expectRoundTrip('FROM node@sha256:abc123');
    });

    it('should round-trip RUN instruction (shell form)', () => {
      expectRoundTrip('FROM alpine\nRUN echo hello');
    });

    it('should round-trip RUN instruction (exec form)', () => {
      expectRoundTrip('FROM alpine\nRUN ["echo", "hello"]');
    });

    it('should round-trip COPY instruction', () => {
      expectRoundTrip('FROM alpine\nCOPY src/ dest/');
    });

    it('should round-trip COPY with --from flag', () => {
      expectRoundTrip('FROM alpine\nCOPY --from=builder /app /app');
    });

    it('should round-trip ADD instruction', () => {
      expectRoundTrip('FROM alpine\nADD https://example.com/file.tar.gz /app/');
    });

    it('should round-trip ENV instruction', () => {
      expectRoundTrip('FROM alpine\nENV NODE_ENV=production');
    });

    it('should round-trip ARG instruction', () => {
      expectRoundTrip('FROM alpine\nARG VERSION=1.0.0');
    });

    it('should round-trip ARG without default', () => {
      expectRoundTrip('FROM alpine\nARG VERSION');
    });

    it('should round-trip WORKDIR instruction', () => {
      expectRoundTrip('FROM alpine\nWORKDIR /app');
    });

    it('should round-trip USER instruction', () => {
      expectRoundTrip('FROM alpine\nUSER node');
    });

    it('should round-trip USER with group', () => {
      expectRoundTrip('FROM alpine\nUSER node:node');
    });

    it('should round-trip EXPOSE instruction', () => {
      expectRoundTrip('FROM alpine\nEXPOSE 80');
    });

    it('should round-trip EXPOSE with protocol', () => {
      expectRoundTrip('FROM alpine\nEXPOSE 80/tcp 443/tcp');
    });

    it('should round-trip VOLUME instruction', () => {
      expectRoundTrip('FROM alpine\nVOLUME /data');
    });

    it('should round-trip LABEL instruction', () => {
      expectRoundTrip('FROM alpine\nLABEL version=1.0');
    });

    it('should round-trip CMD instruction (exec form)', () => {
      expectRoundTrip('FROM alpine\nCMD ["node", "server.js"]');
    });

    it('should round-trip CMD instruction (shell form)', () => {
      expectRoundTrip('FROM alpine\nCMD node server.js');
    });

    it('should round-trip ENTRYPOINT instruction', () => {
      expectRoundTrip('FROM alpine\nENTRYPOINT ["python", "app.py"]');
    });

    it('should round-trip SHELL instruction', () => {
      expectRoundTrip('FROM alpine\nSHELL ["/bin/bash", "-c"]');
    });

    it('should round-trip HEALTHCHECK instruction', () => {
      expectRoundTrip('FROM alpine\nHEALTHCHECK --interval=30s CMD ["curl", "-f", "http://localhost/"]');
    });

    it('should round-trip HEALTHCHECK NONE', () => {
      expectRoundTrip('FROM alpine\nHEALTHCHECK NONE');
    });

    it('should round-trip STOPSIGNAL instruction', () => {
      expectRoundTrip('FROM alpine\nSTOPSIGNAL SIGTERM');
    });
  });

  describe('multi-stage builds', () => {
    it('should round-trip simple multi-stage build', () => {
      expectRoundTrip(`FROM node:18 AS builder
WORKDIR /app

FROM node:18-alpine
COPY --from=builder /app /app`);
    });

    it('should round-trip complex multi-stage build', () => {
      expectRoundTrip(`FROM golang:1.21 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /app/server

FROM alpine:3.18
COPY --from=builder /app/server /usr/local/bin/server
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/server"]`);
    });
  });

  describe('parser directives', () => {
    it('should round-trip escape directive', () => {
      expectRoundTrip(`# escape=\`
FROM alpine`);
    });
  });

  describe('complete Dockerfiles', () => {
    it('should round-trip a typical Node.js Dockerfile', () => {
      expectRoundTrip(`FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]`);
    });

    it('should round-trip a Python Dockerfile with ENV and ARG', () => {
      expectRoundTrip(`FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
ARG VERSION=1.0.0
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
USER nobody
ENTRYPOINT ["python", "app.py"]`);
    });
  });
});
