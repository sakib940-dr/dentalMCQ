import ToothMark from './ToothMark';

export default function BrandWordmark({ size = 56 }) {
  return (
    <div className="brand-wordmark">
      <ToothMark size={size} />
      <div className="brand-wordmark-text">
        <span className="brand-wordmark-title">
          <span className="brand-wordmark-title-dark">Dental</span>
          <span className="brand-wordmark-title-gold">MCQ</span>
        </span>
        <span className="brand-wordmark-tagline">Study · Practice · Succeed</span>
      </div>
    </div>
  );
}
