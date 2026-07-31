import assetList from '../__fixtures__/assets.json';
import { jsonStringify } from '../src';

it('assetlist', () => {
  expect(jsonStringify(assetList, { camelCase: true, space: 2 })).toMatchSnapshot();
});