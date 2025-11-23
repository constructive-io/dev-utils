import fs from 'node:fs/promises';
import { runCopy } from '../src/commands/copy';

jest.mock('node:fs/promises');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('runCopy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.copyFile.mockResolvedValue(undefined);
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
    } as any);
  });

  it('should copy a single file to destination', async () => {
    await runCopy(['README.md', 'dist', '--flat']);

    expect(mockedFs.mkdir).toHaveBeenCalledWith('dist', { recursive: true });
    expect(mockedFs.copyFile).toHaveBeenCalledWith('README.md', 'dist/README.md');
  });

  it('should copy multiple files to destination', async () => {
    await runCopy(['file1.txt', 'file2.txt', 'dist', '--flat']);

    expect(mockedFs.copyFile).toHaveBeenCalledWith('file1.txt', 'dist/file1.txt');
    expect(mockedFs.copyFile).toHaveBeenCalledWith('file2.txt', 'dist/file2.txt');
  });

  it('should throw error if less than 2 arguments', async () => {
    await expect(runCopy(['onlyDest'])).rejects.toThrow(
      'copy requires at least one source and one destination'
    );
  });

  it('should throw error if source is a directory', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => true,
    } as any);

    await expect(runCopy(['somedir', 'dist'])).rejects.toThrow(
      'Directories not yet supported as sources: somedir'
    );
  });
});
