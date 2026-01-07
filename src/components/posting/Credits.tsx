"use client";

interface CreditsProps {
  credits: any;
}

export function Credits({ credits }: CreditsProps) {
  if (!credits) return null;

  const creditsArray = Array.isArray(credits) ? credits : [];

  if (creditsArray.length === 0) return null;

  return (
    <div className="border-t border-gray-200 pt-6">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
        Credits
      </h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {creditsArray.map((credit: any, idx: number) => (
          <div key={idx}>
            <span className="font-medium text-gray-700">{credit.role}</span>
            {credit.url ? (
              <a
                href={credit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-gray-600 hover:text-gray-900 underline"
              >
                {credit.name}
              </a>
            ) : (
              <span className="ml-2 text-gray-600">{credit.name}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

