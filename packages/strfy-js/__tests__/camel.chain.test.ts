import chain from '../__fixtures__/chain.json';
import { jsStringify } from '../src';

it('chain', () => {
  expect(jsStringify(chain, { camelCase: true, space: 2 })).toMatchSnapshot();
});