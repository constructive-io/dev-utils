import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

import { findAndRequirePackageJson } from '../src';

// Mock dependencies
jest.mock('fs');
jest.mock('path');

describe('findAndRequirePackageJson', () => {
  const mockPackageJson = {
    name: 'mock-package',
    version: '1.0.0',
    description: 'A mock package for testing',
    main: 'index.js',
    scripts: {
      test: 'jest',
    },
    dependencies: {
      jest: '^27.0.0',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should find and parse package.json in the current directory', () => {
    const mockCurrentDir = '/mock/current/dir';
    const mockFilePath = join(mockCurrentDir, 'package.json');

    (existsSync as jest.Mock).mockReturnValue(true);
    (readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify(mockPackageJson)
    );
    (dirname as jest.Mock).mockReturnValue(mockCurrentDir);
    (join as jest.Mock).mockReturnValue(mockFilePath);

    jest.spyOn(process, 'cwd').mockReturnValue(mockCurrentDir);

    const result = findAndRequirePackageJson(mockCurrentDir);

    expect(result).toEqual(mockPackageJson);
    expect(existsSync).toHaveBeenCalledWith(mockFilePath);
    expect(readFileSync).toHaveBeenCalledWith(mockFilePath, 'utf8');
  });

  it('should throw an error if package.json is not found', () => {
    const mockCurrentDir = '/mock/current/dir';
    const mockParentDir = '/mock/current';
    const mockFilePath = join(mockCurrentDir, 'package.json');

    (existsSync as jest.Mock).mockReturnValue(false);
    (dirname as jest.Mock)
      .mockReturnValueOnce(mockParentDir)
      .mockReturnValueOnce(mockParentDir);

    jest.spyOn(process, 'cwd').mockReturnValue(mockCurrentDir);

    expect(() => findAndRequirePackageJson(mockCurrentDir)).toThrow(
      'package.json not found in any parent directory'
    );
    expect(existsSync).toHaveBeenCalledWith(mockFilePath);
  });
});
