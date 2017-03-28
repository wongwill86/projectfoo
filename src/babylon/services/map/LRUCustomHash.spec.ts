import LRUHashString from './LRUCustomHash';

interface Foo {
  foo: number;
  fofoo?: number;
}

test('Get and set <number, string> works.', () => {
  let key = 1;
  let value = 'one';
  let key2 = 2;
  let value2 = 'two';
  let map = new LRUHashString<number, string>(10);
  map.set(key, value);
  map.set(key2, value2);

  let expected = value;
  let actual = map.get(key);
  expect(actual).toEqual(expected);

  let expected2 = value2;
  let actual2 = map.get(key2);
  expect(actual2).toEqual(expected2);
});

test('Getting from default JSON.stringify correctly does hash collision.', () => {
  let key: Foo = {foo: 1};
  let value = 'one';
  let map = new LRUHashString<Foo, string>(10);
  map.set(key, value);

  let expected = value;
  let actual = map.get({foo: 1});
  expect(actual).toEqual(expected);
});

test('Getting and setting using custom hash function works correctly.', () => {
  let key: Foo = {foo: 1, fofoo: 32};
  let value = 'one';
  let map = new LRUHashString<Foo, string>({
    limit: 10,
    toHash: (keyHash: Foo) => {
      return JSON.stringify(keyHash, ['foo']);
    },
  });
  map.set(key, value);

  let expected = value;
  let actual = map.get({foo: 1, fofoo: 33});
  expect(actual).toEqual(expected);
});

test('forEach gets original key from hash function', () => {
  let key: Foo = {foo: 1, fofoo: 32};
  let value = 'one';
  let map = new LRUHashString<Foo, string>(10);
  map.set(key, value);

  map.forEach((myValue: string, myKey: Foo) => {
    expect(myKey).toEqual(key);
  });
});

test('LRU removes the last used key and values', () => {
  let map = new LRUHashString<Foo, string>({
    limit: 5,
  });

  map.set({foo: 0, fofoo: 32}, 'zeroth');
  map.set({foo: 1, fofoo: 32}, 'first');
  map.set({foo: 2, fofoo: 32}, 'second');
  map.set({foo: 3, fofoo: 32}, 'third');
  map.set({foo: 4, fofoo: 32}, 'fourth');
  map.set({foo: 5, fofoo: 32}, 'fifth');

  // 0 should have been automatically dropped due to size limit
  expect(map.has({foo: 0, fofoo: 32})).toBeFalsy();

  // shift out 1
  let shift = map.shift();
  expect(shift).not.toBeUndefined();
  let [key, value] = shift!;
  expect(key.foo).toBe(1);
  expect(value).toBe('first');

  // remove the next oldest, 2
  let deletedValue = map.delete({foo: 2, fofoo: 32});
  expect(deletedValue).toBeTruthy();

  // touch the next oldest, 3
  expect(map.get({foo: 3, fofoo: 32})).toBe('third');

  // shift out the next oldest 4
  shift = map.shift();
  expect(shift).not.toBeUndefined();
  [key, value] = shift!;
  expect(key.foo).toBe(4);
  expect(value).toBe('fourth');
});

test('LRU recency is unaffected by find', () => {
  let map = new LRUHashString<Foo, string>({
    limit: 5,
  });
  map.set({foo: 0, fofoo: 32}, 'zeroth');
  map.set({foo: 1, fofoo: 32}, 'first');
  map.set({foo: 2, fofoo: 32}, 'second');
  map.find({foo: 0, fofoo: 32});

  let shift = map.shift();
  expect(shift).not.toBeUndefined();
  let [key, value] = shift!;
  expect(key.foo).toBe(0);
  expect(value).toBe('zeroth');
});

test('All keys() are returned correctly', () => {
  let map = new LRUHashString<Foo, string>({
    limit: 5,
  });
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
  let map = new LRUHashString<Foo, string>({
    limit: 5,
  });
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
  let map = new LRUHashString<Foo, string>({
    limit: 5,
  });

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


test('Size limit constraint is met', () => {
  let map = new LRUHashString<Foo, string>({
    limit: 1,
  });
  map.set({foo: 0, fofoo: 32}, 'zeroth');
  map.set({foo: 1, fofoo: 32}, 'first');

  expect(map.has({foo: 0, fofoo: 32})).toBeFalsy();
});
