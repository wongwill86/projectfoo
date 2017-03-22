import LRUMap from './LRUMap';

interface Foo {
  foo: number;
  fofoo?: number;
}

test('Get and set <number, string> works.', () => {
  let key = 1;
  let value = 'one';
  let key2 = 2;
  let value2 = 'two';
  let map = new LRUMap<number, string>(10);
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
  let map = new LRUMap<Foo, string>(10);
  map.set(key, value);

  let expected = value;
  let actual = map.get({foo: 1});
  expect(actual).toEqual(expected);
});

test('Getting and setting using custom hash function works correctly.', () => {
  let key: Foo = {foo: 1, fofoo: 32};
  let value = 'one';
  let map = new LRUMap<Foo, string>({
    toHash: (keyHash: Foo) => {
      return JSON.stringify(keyHash, ['foo']);
    },
  });
  map.set(key, value);

  let expected = value;
  let actual = map.get({foo: 1, fofoo: 33});
  expect(actual).toEqual(expected);
});

test('forEach correctly recreates key from hash function', () => {
  let key: Foo = {foo: 1, fofoo: 32};
  let value = 'one';
  let map = new LRUMap<Foo, string>({});
  map.set(key, value);

  map.forEach((myValue: string, myKey: Foo, myMap: LRUMap<Foo, string>) => {
    expect(typeof myKey).toEqual('object');
  });
});

test('correctly calls dispose with fromHash', () => {
  let fooVal: number = 1;
  let key: Foo = {foo: fooVal, fofoo: 32};
  let value = 'one';
  let disposeCalled = false;
  let map = new LRUMap<Foo, string>({
    dispose: (myKey: Foo, myValue: String) => {
      expect(typeof myKey).toEqual('object');
      expect(myKey.foo).toEqual(fooVal);
      disposeCalled = true;
    },
    max: 1,
  });

  map.set(key, value);
  map.set(key, value);

  expect(disposeCalled).toBeTruthy();
});

