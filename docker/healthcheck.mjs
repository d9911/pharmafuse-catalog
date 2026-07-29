const port = process.env.PORT ?? '3000';
const response = await fetch(`http://127.0.0.1:${port}/graphql`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    query: '{ __typename }',
  }),
});

if (!response.ok) {
  throw new Error(`GraphQL healthcheck returned HTTP ${response.status}`);
}

const payload = await response.json();
if (payload.data?.__typename !== 'Query') {
  throw new Error('GraphQL healthcheck returned an unexpected payload');
}
