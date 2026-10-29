'use client';

import { Fragment } from 'react';
import { type SubscriptionTierType } from '@/lib/pricing/tiers';

interface Feature {
  key: string;
  label: string;
  description?: string;
  includedIn: SubscriptionTierType[];
}

interface FeatureGroup {
  name: string;
  features: Feature[];
}

interface FeatureComparisonProps {
  featureGroups: FeatureGroup[];
  tiers: SubscriptionTierType[];
}

export function FeatureComparison({ featureGroups, tiers }: FeatureComparisonProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="text-left py-4 pr-4 font-medium text-neutral-900">
              Feature
            </th>
            {tiers.map((tier) => (
              <th
                key={tier}
                className="text-center py-4 px-4 font-medium text-neutral-900 min-w-[100px]"
              >
                {tier}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {featureGroups.map((group) => (
            <Fragment key={group.name}>
              <tr className="border-b border-neutral-200">
                <td
                  colSpan={tiers.length + 1}
                  className="py-4 font-semibold text-neutral-900 bg-neutral-50"
                >
                  {group.name}
                </td>
              </tr>
              {group.features.map((feature) => (
                <tr key={feature.key} className="border-b border-neutral-100">
                  <td className="py-3 pr-4">
                    <span className="text-sm text-neutral-700">{feature.label}</span>
                    {feature.description && (
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {feature.description}
                      </p>
                    )}
                  </td>
                  {tiers.map((tier) => (
                    <td key={`${feature.key}-${tier}`} className="text-center py-3 px-4">
                      {feature.includedIn.includes(tier) ? (
                        <svg
                          className="w-5 h-5 text-green-500 mx-auto"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 text-neutral-300 mx-auto"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
