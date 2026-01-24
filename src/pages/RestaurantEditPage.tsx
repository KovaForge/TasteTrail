import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components';
import { useAuth, useDebug } from '../context';
import { api, setApiContext } from '../services';
import { CUISINES } from '../types';

export function RestaurantEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, user } = useAuth();
  const { addEntry } = useDebug();

  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [addressSuburb, setAddressSuburb] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setApiContext(currentWorkspace?.id || null, user?.id || null, addEntry);
  }, [currentWorkspace?.id, user?.id, addEntry]);

  useEffect(() => {
    async function fetchRestaurant() {
      if (!id) return;
      const response = await api.getRestaurant(id);
      if (response.data) {
        setName(response.data.name || '');
        setCuisine(response.data.cuisine || '');
        setAddressSuburb((response.data as any).address_suburb || response.data.addressSuburb || '');
        setNotes(response.data.notes || '');
      }
      setIsLoading(false);
    }
    fetchRestaurant();
  }, [id]);

  const handleSave = async () => {
    if (!id || !name.trim() || !cuisine.trim()) return;
    setIsSaving(true);
    const response = await api.updateRestaurant(id, {
      name: name.trim(),
      cuisine: cuisine.trim(),
      addressSuburb: addressSuburb.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (response.data) {
      navigate(`/restaurant/${id}`);
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <Layout title="Edit Restaurant" showBack onBack={() => navigate(`/restaurant/${id}`)}>
        <div className="skeleton" style={{ height: 200 }} />
      </Layout>
    );
  }

  return (
    <Layout title="Edit Restaurant" showBack onBack={() => navigate(`/restaurant/${id}`)}>
      <div className="card mb-md">
        <div className="form-group">
          <label className="form-label">Name</label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Cuisine</label>
          <select
            className="form-input form-select"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
          >
            {CUISINES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Suburb / Location</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Newtown, Sydney"
            value={addressSuburb}
            onChange={(e) => setAddressSuburb(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Notes</label>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Any notes about this restaurant..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%' }}
        onClick={handleSave}
        disabled={!name.trim() || !cuisine.trim() || isSaving}
      >
        {isSaving ? 'Saving...' : 'Save Changes'}
      </button>
    </Layout>
  );
}
