"use client";

import React, { useState } from "react";
import Image from '@/components/FolioImage';
import { toast } from "sonner";

interface TeamMember {
  id: string;
  name: string;
  profileImage: string | null;
  title: string | null;
  role: string;
  workEmail: string | null;
}

interface VendorTeamProps {
  members: TeamMember[];
  orgId: string;
  orgName: string;
}

export function VendorTeam({ members, orgId, orgName }: VendorTeamProps) {
  return (
    <div className="space-y-10">
      {/* Team directory */}
      <div>
        <h3 className="font-headline font-light mb-4" style={{ fontSize: 'var(--type-h4)', color: "var(--folio-text-primary)" }}>
          Team
        </h3>
        {members.length === 0 ? (
          <p className="font-body" style={{ fontSize: 'var(--type-meta)', color: "var(--folio-text-tertiary)" }}>
            No team members listed yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map(member => (
              <div
                key={member.id}
                className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: "rgba(245, 239, 232, 0.5)", border: "0.5px solid var(--folio-border-subtle)" }}
              >
                {member.profileImage ? (
                  <Image src={member.profileImage} alt={member.name} width={48} height={48} className="rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-body" style={{ background: "rgba(201,169,110,0.15)", color: "#8a7044", fontSize: 'var(--type-body)', fontWeight: 'var(--w-h1)' }}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-body font-medium" style={{ fontSize: 'var(--type-ui)', color: "var(--folio-text-primary)" }}>{member.name}</div>
                  {member.title && (
                    <div className="font-body" style={{ fontSize: 'var(--type-meta)', color: "var(--folio-text-secondary)" }}>{member.title}</div>
                  )}
                  <div className="font-body" style={{ fontSize: 'var(--type-eyebrow)', color: "var(--folio-text-tertiary)", textTransform: "capitalize" }}>{member.role.toLowerCase()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inquiry form */}
      <div>
        <h3 className="font-headline font-light mb-4" style={{ fontSize: 'var(--type-h4)', color: "var(--folio-text-primary)" }}>
          Get in Touch
        </h3>
        <InquiryForm orgId={orgId} orgName={orgName} />
      </div>
    </div>
  );
}

function InquiryForm({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;

    setSending(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Inquiry sent! The team will be in touch.");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      toast.error("Failed to send inquiry. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-3">
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="w-full font-body rounded-lg px-3.5 py-2.5"
        style={{ fontSize: 'var(--type-meta)', background: "rgba(245,239,232,0.5)", border: "0.5px solid var(--folio-border-subtle)", color: "var(--folio-text-primary)", outline: "none" }}
      />
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="w-full font-body rounded-lg px-3.5 py-2.5"
        style={{ fontSize: 'var(--type-meta)', background: "rgba(245,239,232,0.5)", border: "0.5px solid var(--folio-border-subtle)", color: "var(--folio-text-primary)", outline: "none" }}
      />
      <textarea
        placeholder={`Message for ${orgName}...`}
        value={message}
        onChange={e => setMessage(e.target.value)}
        required
        rows={4}
        className="w-full font-body rounded-lg px-3.5 py-2.5 resize-y"
        style={{ fontSize: 'var(--type-meta)', background: "rgba(245,239,232,0.5)", border: "0.5px solid var(--folio-border-subtle)", color: "var(--folio-text-primary)", outline: "none" }}
      />
      <button
        type="submit"
        disabled={sending}
        className="font-body px-6 py-2.5 rounded-lg cursor-pointer"
        style={{ fontSize: 'var(--type-meta)', fontWeight: 'var(--w-h1)', background: "#3a2a1a", color: "#f5efe8", border: "none", opacity: sending ? 0.5 : 1 }}
      >
        {sending ? "Sending..." : "Send Inquiry"}
      </button>
    </form>
  );
}
