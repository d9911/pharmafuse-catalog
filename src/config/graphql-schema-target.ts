import { join } from 'node:path';

export function resolveGraphqlSchemaTarget(nodeEnv: string, projectRoot: string): string | true {
  if (nodeEnv === 'production') {
    return true;
  }

  return join(projectRoot, 'schema.gql');
}
