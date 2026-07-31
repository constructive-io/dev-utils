import graph from '../../../__fixtures__/jsonld-tools/graph.json';
import { extractSubgraph } from '../src/index';

it('event:cosmjs-roadmap', () => {
  const subgraph = extractSubgraph(graph, 'event:cosmjs-roadmap');
  expect(subgraph).toMatchSnapshot();
});