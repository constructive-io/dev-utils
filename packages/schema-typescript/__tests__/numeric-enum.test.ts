import { generateTypeScript } from '../src';

it('numeric enum values', () => {
  expect(
    generateTypeScript({
      title: 'PostGISConfig',
      type: 'object',
      properties: {
        dimension: {
          type: 'integer',
          enum: [2, 3, 4],
          description: 'Coordinate dimensionality',
        },
        name: {
          type: 'string',
          enum: ['point', 'linestring', 'polygon'],
        },
      },
      required: ['dimension'],
    })
  ).toMatchSnapshot();
});

it('boolean enum values', () => {
  expect(
    generateTypeScript({
      title: 'ToggleConfig',
      type: 'object',
      properties: {
        enabled: {
          enum: [true, false],
        },
      },
    })
  ).toMatchSnapshot();
});

it('mixed enum values', () => {
  expect(
    generateTypeScript({
      title: 'MixedConfig',
      type: 'object',
      properties: {
        status: {
          enum: ['active', 'inactive', 0, 1, true],
        },
      },
    })
  ).toMatchSnapshot();
});

it('numeric const value', () => {
  expect(
    generateTypeScript({
      title: 'FixedDimension',
      type: 'object',
      properties: {
        dimension: {
          const: 3,
        },
        label: {
          const: '3D',
        },
      },
      required: ['dimension', 'label'],
    })
  ).toMatchSnapshot();
});

it('boolean const value', () => {
  expect(
    generateTypeScript({
      title: 'AlwaysEnabled',
      type: 'object',
      properties: {
        enabled: {
          const: true,
        },
        disabled: {
          const: false,
        },
      },
    })
  ).toMatchSnapshot();
});
