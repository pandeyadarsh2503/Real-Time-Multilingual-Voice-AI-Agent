import { updateProfile } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { auth } from '../../firebase';
import { useChat } from '../../context/ChatContext';
import { t } from '../../i18n';
import { appointmentsAPI } from '../../services/api';

const countries = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1', flag: '🇺🇸', name: 'US / Canada' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
];

export default function ProfileView({ user }) {
  const { language } = useChat();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [countryCode, setCountryCode] = useState(localStorage.getItem('patientCountryCode') || '+91');
  const [phoneDigits, setPhoneDigits] = useState(localStorage.getItem(`phone_${user?.uid}`) || '');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, upcoming: 0, favouriteDoctor: null });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [allRes, upcomingRes] = await Promise.all([
          appointmentsAPI.list(),
          appointmentsAPI.upcoming(50),
        ]);
        const all = allRes.data;
        const counts = {};
        all.forEach((a) => { counts[a.doctor] = (counts[a.doctor] || 0) + 1; });
        const favourite = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        setStats({
          total: all.length,
          upcoming: upcomingRes.data.length,
          favouriteDoctor: favourite ? { name: favourite[0], visits: favourite[1] } : null,
        });
      } catch (err) {
        console.error('Failed to load profile stats', err);
      }
    };
    loadStats();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName });
      localStorage.setItem('patientCountryCode', countryCode);
      localStorage.setItem(`phone_${user.uid}`, phoneDigits);
      setIsEditing(false);
      toast.success('Profile updated.');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile.');
    }
    setSaving(false);
  };

  return (
    <div className="view-container fade-in">
      <header className="top-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <div className="header-titles">
          <h1>{t(language, 'view.profile.title')}</h1>
          <p>{t(language, 'view.profile.sub')}</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginTop: '20px' }}>

        {/* User Info */}
        <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: '#94a3b8', marginBottom: '15px' }}>
            {(displayName || user?.displayName || 'G')[0]}
          </div>

          {isEditing ? (
            <div style={{ width: '100%', marginBottom: '15px' }}>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Full Name"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', marginBottom: '10px' }}
              />
              <input
                type="email"
                value={user?.email || ''}
                disabled
                title="Email cannot be changed here"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8', textAlign: 'center', marginBottom: '10px', cursor: 'not-allowed' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  style={{ width: '35%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(e.target.value)}
                  placeholder="Phone Number"
                  style={{ width: '65%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button onClick={() => setIsEditing(false)} disabled={saving} style={{ width: '100%', padding: '10px', marginTop: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ margin: 0 }}>{user?.displayName || 'Guest User'}</h2>
              <div style={{ color: '#64748b', marginTop: '5px' }}>{user?.email}</div>
              {phoneDigits && <div style={{ color: '#64748b', marginTop: '2px' }}>{countryCode} {phoneDigits}</div>}
              <button onClick={() => setIsEditing(true)} style={{ width: '100%', padding: '10px', marginTop: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>Edit Profile</button>
            </>
          )}
        </div>

        {/* Real booking activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="dashboard-card">
            <h3>Your Activity</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>{stats.total}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '5px' }}>Total appointments</div>
              </div>
              <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#166534' }}>{stats.upcoming}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '5px' }}>Upcoming</div>
              </div>
              <div style={{ background: '#eff6ff', padding: '15px', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1d4ed8', marginTop: '8px' }}>
                  {stats.favouriteDoctor ? stats.favouriteDoctor.name : '—'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '5px' }}>
                  {stats.favouriteDoctor ? `Most visited (${stats.favouriteDoctor.visits}×)` : 'No visits yet'}
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-card" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>ℹ️ How your data is used</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '10px', lineHeight: 1.5 }}>
              The assistant remembers your preferred doctor and language from past bookings to speed up
              future conversations. Appointments are linked to your account — only you (and clinic staff)
              can see or cancel them.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
