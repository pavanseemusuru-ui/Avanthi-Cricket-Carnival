export const normalizeBucket = (rawBucket?: string | null): string => {
  if (!rawBucket) return 'B3';
  const b = String(rawBucket).trim().toUpperCase();
  if (['B1', 'B2', 'B3', 'B4', 'B5', 'PG'].includes(b)) return b;
  if (b.startsWith('BUCKET')) {
    const num = b.replace('BUCKET', '').trim();
    if (['1', '2', '3', '4', '5'].includes(num)) return `B${num}`;
  }
  if (['1', '2', '3', '4', '5'].includes(b)) return `B${b}`;
  if (b.includes('1')) return 'B1';
  if (b.includes('2')) return 'B2';
  if (b.includes('3')) return 'B3';
  if (b.includes('4')) return 'B4';
  if (b.includes('5')) return 'B5';
  if (b.includes('PG')) return 'PG';
  return 'B3';
};
