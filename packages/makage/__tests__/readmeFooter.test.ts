import fs from 'node:fs/promises';
import { runReadmeFooter } from '../src/commands/readmeFooter';

jest.mock('node:fs/promises');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('runReadmeFooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
  });

  it('should concatenate README and FOOTER files', async () => {
    mockedFs.readFile
      .mockResolvedValueOnce('# README Content\n\nSome text' as any)
      .mockResolvedValueOnce('## Footer\n\nFooter text' as any);

    await runReadmeFooter([
      '--source',
      'README.md',
      '--footer',
      'FOOTER.md',
      '--dest',
      'dist/README.md',
    ]);

    expect(mockedFs.readFile).toHaveBeenCalledWith('README.md', 'utf8');
    expect(mockedFs.readFile).toHaveBeenCalledWith('FOOTER.md', 'utf8');
    expect(mockedFs.writeFile).toHaveBeenCalledWith(
      'dist/README.md',
      '# README Content\n\nSome text\n\n---\n\n## Footer\n\nFooter text\n',
      'utf8'
    );
  });

  it('should throw error if missing required arguments', async () => {
    await expect(runReadmeFooter(['--source', 'README.md'])).rejects.toThrow(
      'readme-footer requires --source <file> --footer <file> --dest <file>'
    );
  });
});
