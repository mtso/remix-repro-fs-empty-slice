# Repro for Remix empty FS slice bug

## Running Minimal Repro

```ts
npm ci --ignore-scripts
npm test
```

- Observe log error: `RangeError [ERR_OUT_OF_RANGE]: The value of "end" is out of range. It must be >= 0 && <= 9007199254740991. Received -1`

## Running Server Repro

```ts
npm ci --ignore-scripts
npm start
```

- Open http://127.0.0.1:3000
- Upload the `fixtures/empty.png`
- Observe server log error: `Upload processing failed: RangeError [ERR_OUT_OF_RANGE]: The value of "end" is out of range. It must be >= 0 && <= 9007199254740991. Received -1`
