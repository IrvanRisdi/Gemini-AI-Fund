import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBinanceKlines, toBinanceSymbol } from '../dashboard/lib/binance.js';

test('maps desk pair ids to Binance Spot USDT symbols', () => {
  assert.equal(toBinanceSymbol('btcidr'), 'BTCUSDT');
  assert.equal(toBinanceSymbol('eth_idr'), 'ETHUSDT');
  assert.equal(toBinanceSymbol('ZEC/IDR'), 'ZECUSDT');
});

test('parses, orders, limits, and converts Binance klines to IDR', () => {
  const rows = [
    [2_000, '2', '3', '1', '2.5', '20', 0, '0', 0, '0', '0', '0'],
    [1_000, '1', '2', '0.5', '1.5', '10', 0, '0', 0, '0', '0', '0'],
  ];
  const result = parseBinanceKlines(rows, 16_000, 1);

  assert.deepEqual(result, [{
    timestamp: 2_000,
    open: 32_000,
    high: 48_000,
    low: 16_000,
    close: 40_000,
    volume: 20,
  }]);
});
