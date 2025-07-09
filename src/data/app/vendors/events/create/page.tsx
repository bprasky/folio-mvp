"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Type definitions
interface Festival {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
}

export default function VendorCreateEvent() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    festivalToggle: false,
    selectedFestival: null as Festival | null,
  });
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [search, setSearch] = useState("");
  const [dateError, setDateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch festivals from API
  useEffect(() => {
    if (!form.festivalToggle) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/festivals/active`)
      .then(res => res.json())
      .then((data: Festival[]) => setFestivals(data))
      .catch(() => setFestivals([]));
  }, [form.festivalToggle]);

  // Filter festivals by search
  const filteredFestivals = festivals.filter(f =>
    f.title.toLowerCase().includes(search.toLowerCase())
  );

  // Validate event date range fits within selected festival
  useEffect(() => {
    if (form.festivalToggle && form.selectedFestival) {
      if (form.startDate && form.endDate) {
        const s = form.startDate;
        const e = form.endDate;
        const fs = form.selectedFestival.startDate;
        const fe = form.selectedFestival.endDate;
        if (s < fs || e > fe) {
          setDateError(
            `Event dates must be within ${form.selectedFestival.title} (${fs} to ${fe})`
          );
        } else {
          setDateError("");
        }
      }
    } else {
      setDateError("");
    }
  }, [form.startDate, form.endDate, form.selectedFestival, form.festivalToggle]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFestivalSelect = fest => {
    setForm(prev => ({ ...prev, selectedFestival: fest }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    
    try {
      const payload = {
        title: form.title,
        description: form.description,
        location: form.location,
        startDate: form.startDate,
        endDate: form.endDate,
        parentFestivalId: form.festivalToggle && form.selectedFestival ? form.selectedFestival.id : null,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/vendors/events/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create event');
      }

      // Show success message based on response
      if (data.toastMessage) {
        setSuccessMsg(data.toastMessage);
      } else if (payload.parentFestivalId) {
        setSuccessMsg(
          `Your event has been submitted for approval to ${form.selectedFestival?.title}.`
        );
      } else {
        setSuccessMsg("Event created successfully!");
      }

      // Redirect after showing success message
      setTimeout(() => {
        setSuccessMsg("");
        router.push("/vendors/events");
      }, 2000);

    } catch (error) {
      console.error('Error creating event:', error);
      setErrorMsg(error.message || 'Failed to create event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Create Event</h1>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded shadow">
        <div>
          <label className="block font-medium mb-1">Event Title *</label>
          <input
            className="w-full border px-3 py-2 rounded"
            required
            value={form.title}
            onChange={e => handleChange("title", e.target.value)}
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Description *</label>
          <textarea
            className="w-full border px-3 py-2 rounded"
            required
            value={form.description}
            onChange={e => handleChange("description", e.target.value)}
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Location *</label>
          <input
            className="w-full border px-3 py-2 rounded"
            required
            value={form.location}
            onChange={e => handleChange("location", e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block font-medium mb-1">Start Date *</label>
            <input
              type="date"
              className="w-full border px-3 py-2 rounded"
              required
              value={form.startDate}
              onChange={e => handleChange("startDate", e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block font-medium mb-1">End Date *</label>
            <input
              type="date"
              className="w-full border px-3 py-2 rounded"
              required
              value={form.endDate}
              onChange={e => handleChange("endDate", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block font-medium mb-1">Associate with a Festival?</label>
          <div className="flex items-center gap-4 mt-1">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!form.festivalToggle}
                onChange={() => handleChange("festivalToggle", false)}
              />
              No (standalone event)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={form.festivalToggle}
                onChange={() => handleChange("festivalToggle", true)}
              />
              Yes, part of a festival
            </label>
          </div>
        </div>
        {form.festivalToggle && (
          <div className="border p-4 rounded bg-gray-50">
            <label className="block font-medium mb-1">Select Festival *</label>
            <input
              className="w-full border px-3 py-2 rounded mb-2"
              placeholder="Search festivals..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="max-h-32 overflow-y-auto border rounded">
              {filteredFestivals.length === 0 && (
                <div className="p-2 text-gray-500">No festivals found.</div>
              )}
              {filteredFestivals.map(fest => (
                <div
                  key={fest.id}
                  className={`p-2 cursor-pointer hover:bg-blue-100 rounded ${form.selectedFestival && fest.id === form.selectedFestival.id ? "bg-blue-200" : ""}`}
                  onClick={() => handleFestivalSelect(fest)}
                >
                  <div className="font-medium">
                    {fest.title} – {new Date(fest.startDate).toLocaleString('default', { month: 'short', day: 'numeric' })}
                    –{" "}
                    {new Date(fest.endDate).toLocaleString('default', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-xs text-gray-500">
                    {fest.startDate} to {fest.endDate}
                  </div>
                </div>
              ))}
            </div>
            {form.selectedFestival && (
              <div className="mt-2 text-blue-700 text-sm">
                This event will be submitted to {form.selectedFestival.title} for approval.
              </div>
            )}
          </div>
        )}
        {dateError && <div className="text-red-600 text-sm">{dateError}</div>}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded font-semibold mt-4 disabled:opacity-60"
          disabled={submitting || (form.festivalToggle && !form.selectedFestival) || !!dateError}
        >
          {submitting ? "Submitting..." : "Submit Event"}
        </button>
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-100 text-red-800 rounded text-center font-medium">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 bg-green-100 text-green-800 rounded text-center font-medium">
            {successMsg}
          </div>
        )}
      </form>
    </div>
  );
} 