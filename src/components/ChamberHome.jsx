import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { fmtDateTime } from '../lib/formatters';

export default function ChamberHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [todayAppts, setTodayAppts] = useState([]);
  const [upcomingAppts, setUpcomingAppts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const now = new Date();
      const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

      const [
        { count: totalPatients },
        { count: totalPrescriptions },
        { data: todayRows },
        { data: upcomingRows },
      ] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
        supabase.from('prescriptions').select('id', { count: 'exact', head: true }).eq('created_by', user.id),
        supabase.from('appointments').select('*, patients(full_name)').eq('owner_id', user.id).eq('status', 'upcoming')
          .gte('scheduled_at', startOfToday.toISOString()).lte('scheduled_at', endOfToday.toISOString())
          .order('scheduled_at', { ascending: true }),
        supabase.from('appointments').select('*, patients(full_name)').eq('owner_id', user.id).eq('status', 'upcoming')
          .gt('scheduled_at', endOfToday.toISOString())
          .order('scheduled_at', { ascending: true }).limit(5),
      ]);
      if (cancelled) return;
      setStats({ totalPatients: totalPatients || 0, totalPrescriptions: totalPrescriptions || 0, todayCount: (todayRows || []).length });
      setTodayAppts(todayRows || []);
      setUpcomingAppts(upcomingRows || []);
    }
    load();
    return () => { cancelled = true; };
  }, [user.id]);

  return (
    <>
      <div className="panel">
        <h2>Chamber Management</h2>
        <p className="muted small">Your private patient records — separate from the exam platform's shared data.</p>
        <div className="quick-action-grid" style={{ marginTop: 14 }}>
          <button className="quick-action-tile" onClick={() => navigate('/dashboard/prescription')}>
            <span className="quick-action-tile-icon">📋</span>
            <span className="quick-action-tile-label">Smart Prescription</span>
          </button>
          <button className="quick-action-tile" onClick={() => navigate('/dashboard/chamber/patients')}>
            <span className="quick-action-tile-icon">👥</span>
            <span className="quick-action-tile-label">Patient Management</span>
          </button>
        </div>
      </div>

      {stats && (
        <div className="panel">
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-card-value">{stats.totalPatients}</div><div className="stat-card-label">Total Patients</div></div>
            <div className="stat-card"><div className="stat-card-value">{stats.todayCount}</div><div className="stat-card-label">Today's Appointments</div></div>
            <div className="stat-card"><div className="stat-card-value">{stats.totalPrescriptions}</div><div className="stat-card-label">Total Prescriptions</div></div>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Today</h2>
        {todayAppts.length === 0 && <p className="muted small">No appointments scheduled for today.</p>}
        <div className="recent-list">
          {todayAppts.map((a) => (
            <button key={a.id} className="recent-row patient-row-btn" onClick={() => navigate(`/dashboard/chamber/patients/${a.patient_id}`)}>
              <span className="recent-name">{a.patients?.full_name || 'Patient'}</span>
              <span className="muted small">{fmtDateTime(a.scheduled_at)}</span>
            </button>
          ))}
        </div>
      </div>

      {upcomingAppts.length > 0 && (
        <div className="panel">
          <h2>Upcoming</h2>
          <div className="recent-list">
            {upcomingAppts.map((a) => (
              <button key={a.id} className="recent-row patient-row-btn" onClick={() => navigate(`/dashboard/chamber/patients/${a.patient_id}`)}>
                <span className="recent-name">{a.patients?.full_name || 'Patient'}</span>
                <span className="muted small">{fmtDateTime(a.scheduled_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
