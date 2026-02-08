import { useState } from "react";

interface CompanyScraperProps {
  onDataScraped: (data: any) => void;
}

export function CompanyScraper({ onDataScraped }: CompanyScraperProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleScrape = async () => {
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("http://localhost:8000/v1/onboarding/scrape-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        // If endpoint doesn't exist yet, show a helpful message
        if (response.status === 404) {
          setError("Company scraper not yet implemented. You can skip this step.");
        } else {
          throw new Error("Failed to scrape company information");
        }
        return;
      }

      const data = await response.json();
      onDataScraped(data);
      setSuccess(true);
      setUrl("");
    } catch (err) {
      console.error("Scraping failed:", err);
      setError("Company scraper is optional. You can skip this and continue with manual entry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-4 border border-[#e8e6e1]">
      <h4 className="text-sm font-medium text-[#2d2d2a] mb-3">
        🔗 Optional: Import company information
      </h4>
      <p className="text-xs text-[#6b6b63] mb-3 leading-relaxed">
        Paste your LinkedIn company page, website, or Crunchbase profile to auto-fill context
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="https://linkedin.com/company/..."
          className="flex-1 px-3 py-2 bg-white border border-[#d4d2cc] rounded-md text-[#2d2d2a] text-sm placeholder:text-[#9a9a94] focus:outline-none focus:border-[#9a9a94] focus:ring-2 focus:ring-[#9a9a94]/10 transition-all"
        />
        <button
          onClick={handleScrape}
          disabled={loading}
          className="gradient-button text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : "Import"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-[#a0826d] mt-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-[#7a8450] mt-2">✓ Company information imported successfully</p>
      )}
    </div>
  );
}
