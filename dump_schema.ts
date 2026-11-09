/* eslint-disable */
// @ts-nocheck
import _ from 'lodash';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import z from 'zod';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.') || !context.parentURL) throw error;
      const requested = fileURLToPath(new URL(specifier, context.parentURL));
      for (const candidate of [`${requested}.ts`, path.join(requested, 'index.ts')]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
      throw error;
    }
  },
});

fs.globSync('src/**/schema.ts').forEach(async schema_file => {
  try {
    globalThis._ = _;
    globalThis.z = z;
    const module = await import(pathToFileURL(path.resolve(import.meta.dirname, schema_file)).href);
    if (_.has(module, 'Schema')) {
      const schema = _.get(module, 'Schema');
      if (_.isFunction(schema)) {
        schema = schema();
      }
      fs.writeFileSync(
        path.join(path.dirname(schema_file), 'schema.json'),
        JSON.stringify(z.toJSONSchema(schema, { io: 'input', reused: 'ref' }), null, 2),
      );
    }
  } catch (e) {
    process.exitCode = 1;
    console.error(`生成 '${schema_file}' 对应的 schema.json 失败: ${e}`);
  }
});
