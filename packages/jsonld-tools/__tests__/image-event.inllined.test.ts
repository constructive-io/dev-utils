import graph from '../../../__fixtures__/jsonld-tools/graph.json';
import { extractSubgraph, inlineReferences } from '../src/index';

it('image:cosmjs-roadmap-announcement expanded with inlined references', async () => {
  // Extract the subgraph containing the image and all its references
  const subgraph = extractSubgraph(graph, 'image:cosmjs-roadmap-announcement');
  
  // Manually inline all @id references with their full entity data
  const inlined = inlineReferences(subgraph, 'image:cosmjs-roadmap-announcement');
  
  expect(inlined).toMatchSnapshot();
});
