import chain from '../__fixtures__/chain.json';
import { jsonStringify } from '../src';

it('chain', () => {
  expect(jsonStringify(chain, { camelCase: true, space: 2 })).toMatchSnapshot();
});