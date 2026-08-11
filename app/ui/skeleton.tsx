/**
 * What a list looks like before its first read has come back. A collection that
 * has not been asked for yet is not an empty collection: without this, the first
 * paint of a full account says "nothing here yet" and then contradicts itself.
 *
 * Shaped like the rows it becomes, so nothing jumps when they arrive.
 */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-row" />
      ))}
    </div>
  );
}
