const labels = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export default function StatusBadge({ status }) {
  const tone = String(status || '').toLowerCase();

  return (
    <span className={`status-badge status-${tone}`}>
      {labels[status] || status}
    </span>
  );
}
