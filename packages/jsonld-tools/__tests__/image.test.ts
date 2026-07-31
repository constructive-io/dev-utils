import graph from '../../../__fixtures__/jsonld-tools/graph.json';
import { extractSubgraph } from '../src/index';

it('image:cosmjs-roadmap-announcement', () => {
  const subgraph = extractSubgraph(graph, 'image:cosmjs-roadmap-announcement');
  expect(subgraph).toMatchSnapshot();
});