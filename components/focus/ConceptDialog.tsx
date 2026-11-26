'use client';
import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
export default function ConceptDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: 'coffee' | 'envoid';
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [done, setDone] = useState(false),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [date, setDate] = useState(''),
    [time, setTime] = useState('10:00'),
    [guests, setGuests] = useState('2'),
    [topic, setTopic] = useState('A field installation'),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const isCoffee = kind === 'coffee';
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function send(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      name.trim().length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      setError('Please enter your name and a valid email address.');
      return;
    }
    if (isCoffee && (!date || new Date(date + 'T' + time) <= new Date())) {
      setError('Please choose a future date and time.');
      return;
    }
    if (!isCoffee && message.trim().length < 10) {
      setError('Tell us a little about your project (at least 10 characters).');
      return;
    }
    setError('');
    setDone(true);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setDone(false);
          setError('');
        }
      }}
    >
      <DialogContent
        className={
          'concept-dialog ' + (isCoffee ? 'coffee-dialog' : 'envoid-dialog')
        }
      >
        <DialogTitle>
          {done
            ? 'A little possibility, saved.'
            : isCoffee
              ? 'Make time for a good morning.'
              : 'Begin a conversation.'}
        </DialogTitle>
        <DialogDescription>
          {done
            ? 'This is a demonstration. Nothing has been sent or booked.'
            : isCoffee
              ? 'Try the Opal table reservation concept. No real booking is made.'
              : 'Explore an ENvoid project inquiry. This form is a demonstration.'}
        </DialogDescription>
        {done ? (
          <div className="concept-success">
            <Check size={32} />
            <h3>
              {isCoffee
                ? 'Your demo table is ready.'
                : 'Your demo inquiry is ready.'}
            </h3>
            <p>
              {name}
              {isCoffee
                ? ` · ${guests} guests · ${date} at ${time}`
                : ` · ${topic}`}
            </p>
            <p>
              {isCoffee
                ? 'No reservation or email has been sent.'
                : 'No message or email has been sent.'}
            </p>
            <button
              className="button primary"
              onClick={() => {
                setDone(false);
                setError('');
                onOpenChange(false);
              }}
            >
              Back to exploring <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="concept-form">
            <div className="field">
              <label htmlFor={kind + '-name'}>Your name *</label>
              <input
                id={kind + '-name'}
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="field">
              <label htmlFor={kind + '-email'}>Email address *</label>
              <input
                id={kind + '-email'}
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
              />
            </div>
            {isCoffee ? (
              <>
                <div className="field">
                  <label htmlFor="visit-date">Date *</label>
                  <input
                    id="visit-date"
                    type="date"
                    min={today}
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="concept-form-row">
                  <div className="field">
                    <label id="time-label" htmlFor="time-select">
                      Time
                    </label>
                    <Select
                      value={time}
                      onValueChange={(v) => setTime(String(v))}
                    >
                      <SelectTrigger
                        id="time-select"
                        aria-labelledby="time-label"
                        className="form-select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          '08:00',
                          '09:00',
                          '10:00',
                          '11:00',
                          '12:00',
                          '13:00',
                          '14:00',
                          '15:00',
                          '16:00',
                        ].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="field">
                    <label id="guests-label" htmlFor="guests-select">
                      Guests
                    </label>
                    <Select
                      value={guests}
                      onValueChange={(v) => setGuests(String(v))}
                    >
                      <SelectTrigger
                        id="guests-select"
                        aria-labelledby="guests-label"
                        className="form-select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['1', '2', '3', '4', '5', '6'].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label id="topic-label" htmlFor="topic-select">
                    I’m interested in
                  </label>
                  <Select
                    value={topic}
                    onValueChange={(v) => setTopic(String(v))}
                  >
                    <SelectTrigger
                      className="form-select"
                      id="topic-select"
                      aria-labelledby="topic-label"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        'A field installation',
                        'Design collaboration',
                        'The research concept',
                      ].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="field">
                  <label htmlFor="envoid-message">
                    Tell us a little more *
                  </label>
                  <textarea
                    id="envoid-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={3}
                  />
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button type="submit" className="button primary">
              {isCoffee ? 'Preview reservation' : 'Preview inquiry'}
              <ArrowRight size={18} />
            </button>
            <p className="field-hint">
              Your details stay in this page. No payment is required.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
