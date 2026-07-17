import { useTranslation } from 'react-i18next';

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const tone = String(status || '').toLowerCase();

  return (
    <span className={`status-badge status-${tone}`}>
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}
