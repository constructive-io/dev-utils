import schema from '../../../__fixtures__/openapi/swagger_extended.json';
import { generateOpenApiClient } from '../src/openapi';
import { getDefaultSchemaSDKOptions } from '../src/types';
import { OpenAPIOptions } from '../src/types';

describe('PATCH method body parameter resolution', () => {
  it('resolves $ref body parameters and emits params.body for patch methods', () => {
    const options = getDefaultSchemaSDKOptions({
      clientName: 'TestClient',
      includeSwaggerUrl: false,
    });
    const code = generateOpenApiClient(
      {
        ...options,
        mergedParams: false,
        paths: {
          include: ['/api/v1/namespaces/*/configmaps/*'],
          excludeRequests: ['head', 'options'],
        },
        namingStrategy: {
          useLastSegment: true,
        },
      } as OpenAPIOptions,
      schema as any
    );

    // The patchCoreV1NamespacedConfigMap method should pass params.body, not null
    expect(code).toContain('params.body');

    // Specifically verify the patch method passes body correctly
    const patchMethodMatch = code.match(
      /async patchCoreV1NamespacedConfigMap[\s\S]*?return await this\.patch[^;]+;/
    );
    expect(patchMethodMatch).toBeTruthy();
    const patchMethodBody = patchMethodMatch![0];
    expect(patchMethodBody).toContain('this.patch');
    expect(patchMethodBody).toContain('params.body');
    expect(patchMethodBody).not.toContain('null');
  });

  it('still emits null for methods without body parameters', () => {
    const options = getDefaultSchemaSDKOptions({
      clientName: 'TestClient',
      includeSwaggerUrl: false,
    });
    const code = generateOpenApiClient(
      {
        ...options,
        mergedParams: false,
        paths: {
          include: ['/api/v1/namespaces/*/configmaps/*'],
          excludeRequests: ['head', 'options'],
        },
        namingStrategy: {
          useLastSegment: true,
        },
      } as OpenAPIOptions,
      schema as any
    );

    // GET methods should still have null for body
    const getMethodMatch = code.match(
      /async readCoreV1NamespacedConfigMap[\s\S]*?return await this\.get[^;]+;/
    );
    expect(getMethodMatch).toBeTruthy();
    const getMethodBody = getMethodMatch![0];
    expect(getMethodBody).toContain('this.get');
    // GET should not pass params.body
    expect(getMethodBody).not.toContain('params.body');
  });

  it('resolves $ref body parameters for POST and PUT methods too', () => {
    const options = getDefaultSchemaSDKOptions({
      clientName: 'TestClient',
      includeSwaggerUrl: false,
    });
    const code = generateOpenApiClient(
      {
        ...options,
        mergedParams: false,
        paths: {
          include: ['/api/v1/namespaces/*/configmaps', '/api/v1/namespaces/*/configmaps/*'],
          excludeRequests: ['head', 'options'],
        },
        namingStrategy: {
          useLastSegment: true,
        },
      } as OpenAPIOptions,
      schema as any
    );

    // POST (create) should also pass params.body
    const createMatch = code.match(
      /async createCoreV1NamespacedConfigMap[\s\S]*?return await this\.post[^;]+;/
    );
    expect(createMatch).toBeTruthy();
    expect(createMatch![0]).toContain('params.body');

    // PUT (replace) should also pass params.body
    const replaceMatch = code.match(
      /async replaceCoreV1NamespacedConfigMap[\s\S]*?return await this\.put[^;]+;/
    );
    expect(replaceMatch).toBeTruthy();
    expect(replaceMatch![0]).toContain('params.body');
  });
});
