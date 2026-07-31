import assetList from '../__fixtures__/assets.json';
import { jsStringify } from '../src';

it('assetlist', () => {
  expect(jsStringify(assetList, { camelCase: true, space: 2 })).toMatchSnapshot();
});