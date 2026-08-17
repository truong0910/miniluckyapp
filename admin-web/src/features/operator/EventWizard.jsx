import EventDashboard from "./EventDashboard.jsx";
import EventSetupStep from "./EventSetupStep.jsx";
import AudienceImportStep from "./AudienceImportStep.jsx";
import RewardModeStep from "./RewardModeStep.jsx";
import RuleBuilderStep from "./RuleBuilderStep.jsx";
import LaunchChecklist from "./LaunchChecklist.jsx";

const OPERATOR_STEPS = [
  { id: "overview", number: 1, title: "Tổng quan", icon: "📊" },
  { id: "setup", number: 2, title: "Thiết lập", icon: "⚙️" },
  { id: "participants", number: 3, title: "Khách tham gia", icon: "👥" },
  { id: "reward_mode", number: 4, title: "Phát thưởng", icon: "🎁" },
  { id: "rules", number: 5, title: "Luật quay", icon: "⚖️" },
  { id: "readiness", number: 6, title: "Kích hoạt", icon: "🚀" },
];

export default function EventWizard({
  activeStep = "overview",
  onSelectStep,
  campaign,
  campaigns = [],
  onSelectCampaign,
  onCampaignSaved,
  onTransitionStatus,
  renderAwardsTab,
}) {
  return (
    <div className="operator-wizard-shell">
      {/* Wizard Progress Stepper Bar */}
      <nav className="wizard-stepper-bar">
        {OPERATOR_STEPS.map((step) => {
          const isActive = activeStep === step.id;
          return (
            <button
              key={step.id}
              className={`wizard-step-btn ${isActive ? "active" : ""}`}
              onClick={() => onSelectStep(step.id)}
            >
              <span className="step-num">{step.number}</span>
              <span className="step-icon">{step.icon}</span>
              <span className="step-title">{step.title}</span>
            </button>
          );
        })}
      </nav>

      {/* Wizard Step Content Container */}
      <div className="wizard-step-content">
        {activeStep === "overview" && (
          <EventDashboard campaign={campaign} onNavigateStep={onSelectStep} />
        )}

        {activeStep === "setup" && (
          <EventSetupStep
            campaign={campaign}
            campaigns={campaigns}
            onSelectCampaign={onSelectCampaign}
            onCampaignSaved={onCampaignSaved}
            onNextStep={onSelectStep}
          />
        )}

        {activeStep === "participants" && (
          <AudienceImportStep campaign={campaign} onNextStep={onSelectStep} />
        )}

        {activeStep === "reward_mode" && (
          <RewardModeStep campaign={campaign} onNextStep={onSelectStep} />
        )}

        {activeStep === "rules" && (
          <RuleBuilderStep campaign={campaign} onNextStep={onSelectStep} />
        )}

        {activeStep === "readiness" && (
          <LaunchChecklist
            campaign={campaign}
            onTransitionStatus={onTransitionStatus}
            onNextStep={onSelectStep}
          />
        )}

        {activeStep === "awards" && renderAwardsTab && renderAwardsTab()}
      </div>
    </div>
  );
}
