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

test('removes the last used key and values', () => {
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
  expect(deletedValue).toBe('second');

  // touch the next oldest, 3
  expect(map.get({foo: 3, fofoo: 32})).toBe('third');

  // shift out the next oldest 4
  shift = map.shift();
  expect(shift).not.toBeUndefined();
  [key, value] = shift!;
  expect(key.foo).toBe(4);
  expect(value).toBe('fourth');
});

