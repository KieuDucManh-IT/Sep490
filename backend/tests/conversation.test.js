import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNotAdmin } from '../src/services/conversationService.js';

test('checkNotAdmin should throw 403 error for admin role', () => {
  assert.throws(
    () => checkNotAdmin('admin'),
    (err) => {
      assert.equal(err.status, 403);
      assert.match(err.message, /Admin/);
      return true;
    }
  );

  assert.throws(
    () => checkNotAdmin('ADMIN'),
    (err) => {
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test('checkNotAdmin should allow customer, branch_manager, and owner', () => {
  assert.doesNotThrow(() => checkNotAdmin('customer'));
  assert.doesNotThrow(() => checkNotAdmin('CUSTOMER'));
  assert.doesNotThrow(() => checkNotAdmin('branch_manager'));
  assert.doesNotThrow(() => checkNotAdmin('owner'));
  assert.doesNotThrow(() => checkNotAdmin('shop_owner'));
});

