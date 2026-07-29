import { resolveGraphqlSchemaTarget } from './graphql-schema-target';

describe('resolveGraphqlSchemaTarget', () => {
  it('keeps the generated schema in memory in production', () => {
    expect(resolveGraphqlSchemaTarget('production', '/app')).toBe(true);
  });

  it('writes the generated schema to the project root outside production', () => {
    expect(resolveGraphqlSchemaTarget('development', '/workspace')).toBe('/workspace/schema.gql');
  });
});
