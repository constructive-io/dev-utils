import assetList from '../__fixtures__/assetlist.schema.json';
import { jsStringify, JSStringifyOptions, JSStringifyPropertyReplacerOptions } from '../src';

it('AssetList Modification', () => {
  const options: JSStringifyOptions = {
    space: 2,
    propertyRenameMap: {
      '/$defs/asset/properties/type_asset': 'asset_type',
      '/$defs/asset/if/properties/type_asset': 'asset_type'
    },
    valueReplacer: {
      '/$defs/asset/if/required': (opts: JSStringifyPropertyReplacerOptions<any, any>) => {
        return ['asset_type'];
      },
    }
  };
  const jsonString = jsStringify(assetList, options);
  expect(jsonString).toMatchSnapshot();
});
