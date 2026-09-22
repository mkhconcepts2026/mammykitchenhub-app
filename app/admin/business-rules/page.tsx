"use client";

import BusinessRulesHeader from "@/components/admin/business-rules/BusinessRulesHeader";
import GovernanceCommandCentre from "@/components/admin/business-rules/GovernanceCommandCentre";
import CommissionRulesSection from "@/components/admin/business-rules/CommissionRulesSection";
import DeliveryRulesSection from "@/components/admin/business-rules/DeliveryRulesSection";
import PlatformChargesSection from "@/components/admin/business-rules/PlatformChargesSection";
import SettlementPoliciesSection from "@/components/admin/business-rules/SettlementPoliciesSection";
import TerritoryRulesSection from "@/components/admin/business-rules/TerritoryRulesSection";
import VendorOverridesSection from "@/components/admin/business-rules/VendorOverridesSection";
import RiderPoliciesSection from "@/components/admin/business-rules/RiderPoliciesSection";
import PromotionRulesSection from "@/components/admin/business-rules/PromotionRulesSection";
import ApprovalQueue from "@/components/admin/business-rules/ApprovalQueue";
import RuleHistory from "@/components/admin/business-rules/RuleHistory";

export default function BusinessRulesPage() {

  return (

    <main className="min-h-screen bg-slate-50 p-8">

      <div className="mx-auto max-w-7xl space-y-8">

        <BusinessRulesHeader />

        <GovernanceCommandCentre />

        <CommissionRulesSection />

        <DeliveryRulesSection />

        <PlatformChargesSection />

        <SettlementPoliciesSection />

        <TerritoryRulesSection />

        <VendorOverridesSection />

        <RiderPoliciesSection />

        <PromotionRulesSection />

        <ApprovalQueue />

        <RuleHistory />

      </div>

    </main>

  );

}