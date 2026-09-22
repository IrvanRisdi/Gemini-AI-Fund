import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBinanceKlines, toBinanceSymbol } from '../dashboard/lib/binance.js';

test('maps desk pair ids to Binance Spot USDT symbols', () => {
  assert.equal(toBinanceSymbol('btcidr'), 'BTCUSDT');
  assert.equal(toBinanceSymbol('eth_idr'), 'ETHUSDT');
  assert.equal(toBinanceSymbol('ZEC/IDR'), 'ZECUSDT');
});

test('parses, orders, and limits native Binance USDT klines', () => {
  const rows = [
    [2_000, '2', '3', '1', '2.5', '20', 0, '0', 0, '0', '0', '0'],
    [1_000, '1', '2', '0.5', '1.5', '10', 0, '0', 0, '0', '0', '0'],
  ];
  const result = parseBinanceKlines(rows, 1);

  assert.deepEqual(result, [{
    timestamp: 2_000,
    open: 2,
    high: 3,
    low: 1,
    close: 2.5,
    volume: 20,
  }]);
});
