import { Options, default as HashMap } from './HashMap';

interface Foo {
  foo: number;
  fofoo?: number;
}

test('Get and set <Foo, number, string> works.', () => {
  let options: Options<Foo, number> = { toHash: (foo: Foo ) => foo.foo };
  let foo1 = { foo: 0 };
  let value1 = 'zeroth';
  let foo2 = { foo: 1 };
  let value2 = 'first';
  let map = new HashMap<Foo, string, number>(options);
  map.set(foo1, 'zeroth');
  map.set(foo2, 'first');

  let actual = map.get(foo1);
  expect(actual).toEqual(value1);

  let actual2 = map.get(foo2);
  expect(actual2).toEqual(value2);
});

test('Collisions in hash should return corresponding values', () => {
  let options: Options<Foo, number> = { toHash: (foo: Foo ) => foo.foo % 2 };
  let foo1: Foo = {foo: 1, fofoo: 32};
  let value1 = 'zeroth';
  let map = new HashMap<Foo, string, number>(options);
  map.set(foo1, value1);

  let foo2: Foo = {foo: 3, fofoo: 22};
  let actual = map.get(foo2);
  expect(actual).toEqual(value1);
});

test('forEach gets original key object from hash function', () => {
  let options: Options<Foo, number> = { toHash: (foo: Foo ) => foo.foo % 2 };
  let key: Foo = {foo: 1, fofoo: 32};
  let value = 'zeroth';
  let map = new HashMap<Foo, string, number>(options);
  map.set(key, value);

  map.forEach((myValue: string, myKey: Foo) => {
    expect(myKey).toEqual(key);
  });
});


test('All keys() are returned correctly', () => {
  let options: Options<Foo, number> = { toHash: (foo: Foo ) => foo.foo };
  let map = new HashMap<Foo, string, number>(options);
  let foo1 = {foo: 0, fofoo: 32};
  let foo2 = {foo: 1, fofoo: 32};
  let foo3 = {foo: 2, fofoo: 32};
  map.set(foo1, 'zeroth');
  map.set(foo2, 'first');
  map.set(foo3, 'second');

  let keys = map.keys();

  let key = keys.next();
  expect(key).toMatchObject({done: false, value: foo1});
  expect(key.value).toBe(foo1);
  key = keys.next();
  expect(key).toMatchObject({done: false, value: foo2});
  expect(key.value).toBe(foo2);
  key = keys.next();
  expect(key).toMatchObject({done: false, value: foo3});
  expect(key.value).toBe(foo3);
  key = keys.next();
  expect(key).toMatchObject({done: true});
});

test('All values() are returned correctly', () => {
  let options: Options<Foo, number> = { toHash: (foo: Foo ) => foo.foo };
  let map = new HashMap<Foo, string, number>(options);
  map.set({foo: 0, fofoo: 32}, 'zeroth');
  map.set({foo: 1, fofoo: 32}, 'first');
  map.set({foo: 2, fofoo: 32}, 'second');

  let values = map.values();

  let value = values.next();
  expect(value).toMatchObject({done: false, value: 'zeroth'});
  value = values.next();
  expect(value).toMatchObject({done: false, value: 'first'});
  value = values.next();
  expect(value).toMatchObject({done: false, value: 'second'});
  value = values.next();
  expect(value).toMatchObject({done: true});
});

test('All entries() are returned correctly', () => {
  let options: Options<Foo, number> = { toHash: (foo: Foo ) => foo.foo };
  let map = new HashMap<Foo, string, number>(options);

  let foo1 = {foo: 0, fofoo: 32};
  let foo2 = {foo: 1, fofoo: 32};
  let foo3 = {foo: 2, fofoo: 32};
  map.set(foo1, 'zeroth');
  map.set(foo2, 'first');
  map.set(foo3, 'second');

  let entries = map.entries();

  let entry = entries.next();
  expect(entry).toMatchObject({ done: false, value: [ foo1, 'zeroth' ]});
  expect(entry.value[0]).toBe(foo1);
  entry = entries.next();
  expect(entry).toMatchObject({ done: false, value: [ foo2, 'first' ]});
  expect(entry.value[0]).toBe(foo2);
  entry = entries.next();
  expect(entry).toMatchObject({ done: false, value: [ foo3, 'second' ]});
  expect(entry.value[0]).toBe(foo3);
  entry = entries.next();
  expect(entry).toMatchObject({done: true});
});

