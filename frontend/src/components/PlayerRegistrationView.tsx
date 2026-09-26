import React, { useRef, useState } from 'react';
import { api } from '../services/api';
import { UserPlus, AlertCircle, Sparkles, ImagePlus } from 'lucide-react';

interface PlayerRegistrationViewProps {
  onSuccess: () => void;
}

const BASE_PRICE_LADDER = [20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 230, 250];
const MAX_PHOTO_SIZE_BYTES = 300 * 1024;

export const PlayerRegistrationView: React.FC<PlayerRegistrationViewProps> = ({ onSuccess }) => {
  const [rollNumber, setRollNumber] = useState('');
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [photoData, setPhotoData] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [cricheroesUrl, setCricheroesUrl] = useState('');
  const [cricheroesMobile, setCricheroesMobile] = useState('');
  const [basePrice, setBasePrice] = useState<number>(20);

  // Parsed Roll Number Info
  const [parsedInfo, setParsedInfo] = useState<any>(null);
  const parseRequestSequence = useRef(0);
  const [pgProgram, setPgProgram] = useState('M.Tech');
  const [pgBranch, setPgBranch] = useState('');
  const [pgYear, setPgYear] = useState(1);
  const [yearDiscrepancyReported, setYearDiscrepancyReported] = useState(false);
  const [pgAdmissionYear, setPgAdmissionYear] = useState(() => {
    const today = new Date();
    return String(today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1);
  });

  // Branching Skill Questionnaire
  const [isSkilledBatter, setIsSkilledBatter] = useState<boolean>(false);
  const [battingStyle, setBattingStyle] = useState<string>('Aggressive batter');
  const [preferredBattingPos, setPreferredBattingPos] = useState<string>('Middle order');
  const [battingArm, setBattingArm] = useState<string>('Right');

  const [isSkilledBowler, setIsSkilledBowler] = useState<boolean>(false);
  const [bowlingArm, setBowlingArm] = useState<string>('Right');
  const [bowlingType, setBowlingType] = useState<string>('Fast');
  const [paceVariety, setPaceVariety] = useState<string>('Express pace');
  const [spinVariety, setSpinVariety] = useState<string>('Off-spin');
  const [bowlingRoles, setBowlingRoles] = useState<string[]>(['Powerplay specialist']);

  const [isWicketKeeper, setIsWicketKeeper] = useState<boolean>(false);
  const [fieldingZone, setFieldingZone] = useState<string>('Infield');
  const [preferredFieldingPos, setPreferredFieldingPos] = useState<string>('Cover');

  const [confirmFielderOnly, setConfirmFielderOnly] = useState<boolean>(false);

  // Experience & Stats
  const [highestLevelPlayed, setHighestLevelPlayed] = useState<string>('Recreational only');
  const [playedAccBefore, setPlayedAccBefore] = useState<boolean>(false);
  const [previousAccTeam, setPreviousAccTeam] = useState<string>('');
  const [isAccReferred, setIsAccReferred] = useState(false);
  const [referringTeamName, setReferringTeamName] = useState<string>('');

  const [matches, setMatches] = useState<number>(10);
  const [runs, setRuns] = useState<number>(150);
  const [battingAvg, setBattingAvg] = useState<number>(25.0);
  const [strikeRate, setStrikeRate] = useState<number>(130.0);
  const [highestScore, setHighestScore] = useState<number>(0);
  const [wickets, setWickets] = useState<number>(0);
  const [bowlingAvg, setBowlingAvg] = useState<number>(0);
  const [economy, setEconomy] = useState<number>(0.0);
  const [bestBowling, setBestBowling] = useState('0/0');
  const [catches, setCatches] = useState<number>(0);
  const [stumpings, setStumpings] = useState<number>(0);

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePhotoChange = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMsg({ type: 'error', text: 'Please select a valid image file (e.g. JPG, PNG).' });
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoData('');
      setPhotoName('');
      setStatusMsg({ type: 'error', text: 'Photo size must be 300 KB or less.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoData(reader.result);
        setPhotoName(file.name);
        setStatusMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRollNumberChange = (value: string) => {
    setRollNumber(value);
    const sequence = ++parseRequestSequence.current;
    if (value.trim().length < 8) {
      setParsedInfo(null);
      return;
    }
    api.parseRollNumber(value).then((data) => {
      if (sequence === parseRequestSequence.current) setParsedInfo(data);
    }).catch(() => {
      if (sequence === parseRequestSequence.current) setParsedInfo(null);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    // Validation rule §5.1
    if (!isSkilledBatter && !isSkilledBowler && !isWicketKeeper && !confirmFielderOnly) {
      setStatusMsg({
        type: 'error',
        text: 'Validation Error: You have not selected any cricketing skill (Batter, Bowler, or Wicket-keeper). Please select at least one skill or explicitly check the Fielder Only confirmation box.',
      });
      return;
    }
    if (!photoData) {
      setStatusMsg({ type: 'error', text: 'A player photograph is required.' });
      return;
    }

    try {
      await api.registerPlayer({
        roll_number: rollNumber,
        name,
        mobile_number: mobileNumber,
        photo_url: photoData,
        program: parsedInfo?.course === 'PG' ? pgProgram : undefined,
        branch: parsedInfo?.course === 'PG' ? pgBranch : undefined,
        year_of_study: parsedInfo?.course === 'PG' ? pgYear : undefined,
        admission_year: parsedInfo?.course === 'PG' ? Number(pgAdmissionYear) : undefined,
        year_discrepancy_reported: yearDiscrepancyReported,
        cricheroes_url: cricheroesUrl,
        cricheroes_mobile: cricheroesMobile,
        base_price: basePrice,
        is_skilled_batter: isSkilledBatter,
        batting_style: isSkilledBatter ? battingStyle : undefined,
        preferred_batting_pos: isSkilledBatter ? preferredBattingPos : undefined,
        batting_arm: battingArm,
        is_skilled_bowler: isSkilledBowler,
        bowling_arm: isSkilledBowler ? bowlingArm : undefined,
        bowling_type: isSkilledBowler ? bowlingType : undefined,
        pace_variety: isSkilledBowler && bowlingType === 'Fast' ? paceVariety : undefined,
        spin_variety: isSkilledBowler && bowlingType === 'Spin' ? spinVariety : undefined,
        bowling_roles: isSkilledBowler ? bowlingRoles.join(', ') : undefined,
        is_wicket_keeper: isWicketKeeper,
        confirm_fielder_only: confirmFielderOnly,
        fielding_zone: !isWicketKeeper ? fieldingZone : undefined,
        preferred_fielding_pos: !isWicketKeeper ? preferredFieldingPos : undefined,
        highest_level_played: highestLevelPlayed,
        played_acc_before: playedAccBefore,
        previous_acc_team: playedAccBefore ? previousAccTeam : undefined,
        referring_team_name: parsedInfo?.show_acc_reference
          ? isAccReferred ? referringTeamName.trim() : 'No'
          : undefined,
        matches,
        runs,
        batting_avg: battingAvg,
        strike_rate: strikeRate,
        highest_score: highestScore,
        wickets,
        bowling_avg: bowlingAvg,
        economy,
        best_bowling: bestBowling,
        catches,
        stumpings,
      });

      setStatusMsg({ type: 'success', text: 'Registration submitted successfully! Registered under status Completed/Pending profile.' });
      onSuccess();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Registration failed' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="glass-panel rounded-3xl p-6 border border-indigo-500/30 text-center space-y-2 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/40">
          <UserPlus className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-white">Player Registration Form</h1>
        <p className="text-xs text-indigo-300">Avanthi Cricket Carnival 2026–27 &bull; Student Entry Portal</p>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-center space-x-3 text-xs font-bold shadow-lg ${statusMsg.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500' : 'bg-red-950/90 text-red-300 border-red-500'
            }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information & Live Roll Number Parser */}
        <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>1. Basic Student Info &amp; Roll Number Parsing</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Roll Number *</label>
              <input
                type="text"
                placeholder="e.g. 25811A0403 or 24597-CM-015"
                value={rollNumber}
                onChange={(e) => handleRollNumberChange(e.target.value.toUpperCase())}
                className="w-full glass-input rounded-xl p-3 text-xs uppercase font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Full Name *</label>
              <input
                type="text"
                placeholder="Full Student Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full glass-input rounded-xl p-3 text-xs"
                required
              />
            </div>
          </div>

          {/* Parsed Info Box (§4.1) */}
          {parsedInfo && (
            <div className="bg-indigo-950/60 border border-indigo-500/40 p-4 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-indigo-300">Authoritative Academic Parser Result:</p>
              <p className="text-white font-medium">{parsedInfo.formatted_summary}</p>
            </div>
          )}

          {parsedInfo?.course === 'PG' && !parsedInfo.valid && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-800 pt-4">
              <label className="text-xs text-gray-300">Program
                <select value={pgProgram} onChange={(event) => setPgProgram(event.target.value)} className="mt-1 w-full glass-input rounded-xl p-2.5 text-xs bg-gray-900 text-white">
                  <option value="M.Tech">M.Tech</option>
                  <option value="MBA">MBA</option>
                  <option value="MCA">MCA</option>
                </select>
              </label>
              <label className="text-xs text-gray-300">Specialization
                <input required value={pgBranch} onChange={(event) => setPgBranch(event.target.value)} className="mt-1 w-full glass-input rounded-xl p-2.5 text-xs" />
              </label>
              <label className="text-xs text-gray-300">Study year
                <select value={pgYear} onChange={(event) => setPgYear(Number(event.target.value))} className="mt-1 w-full glass-input rounded-xl p-2.5 text-xs bg-gray-900 text-white">
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>
              <label className="text-xs text-gray-300">Admission year
                <input required type="number" min="2000" max={parsedInfo.current_academic_year} value={pgAdmissionYear} onChange={(event) => setPgAdmissionYear(event.target.value)} className="mt-1 w-full glass-input rounded-xl p-2.5 text-xs" />
              </label>
            </div>
          )}
          {parsedInfo?.valid && parsedInfo.course !== 'PG' && (
            <label className="flex items-center gap-2 rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
              <input type="checkbox" checked={yearDiscrepancyReported} onChange={(event) => setYearDiscrepancyReported(event.target.checked)} />
              My actual study year differs from the roll-number result; notify the Super Admin.
            </label>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Mobile Number (Private) *</label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full glass-input rounded-xl p-3 text-xs"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Photograph * (max 300 KB)</label>
              <label className="flex items-center gap-3 w-full glass-input rounded-xl p-3 text-xs cursor-pointer">
                <ImagePlus className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate text-gray-300">{photoName || 'Choose photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
              {photoData && (
                <img src={photoData} alt="Selected player photograph" className="mt-2 h-20 w-20 rounded-xl object-cover border border-indigo-500/40" />
              )}
            </div>
          </div>

          {/* CricHeroes Profile Section (§5.2) */}
          <div className="pt-2 space-y-3 border-t border-gray-800">
            <h4 className="text-xs font-bold text-gray-300">CricHeroes Profile Details (§5.2)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">CricHeroes Profile URL</label>
                <input
                  type="url"
                  placeholder="https://cricheroes.in/..."
                  value={cricheroesUrl}
                  onChange={(e) => setCricheroesUrl(e.target.value)}
                  className="w-full glass-input rounded-xl p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">CricHeroes Registered Phone</label>
                <input
                  type="tel"
                  placeholder="Registered phone on CricHeroes"
                  value={cricheroesMobile}
                  onChange={(e) => setCricheroesMobile(e.target.value)}
                  className="w-full glass-input rounded-xl p-2.5 text-xs"
                />
              </div>
            </div>

            {(!cricheroesUrl || !cricheroesMobile) && (
              <p className="text-[11px] text-amber-400 bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/50">
                No profile yet? Create your player account in CricHeroes, open your player profile, then add its link and registered phone here. You can still register now; the Super Admin must verify the profile before marking payment complete.
              </p>
            )}
          </div>

          {/* Base Price Ladder (§5) */}
          <div className="pt-2">
            <label className="text-xs font-semibold text-gray-300 block mb-2">Base Price (Choose from fixed ladder) *</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {BASE_PRICE_LADDER.map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setBasePrice(val)}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${basePrice === val
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black border-amber-400 shadow-md font-extrabold'
                    : 'bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800'
                    }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Branching Skill Questionnaire (§5.1) */}
        <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-6">
          <h3 className="text-base font-bold text-white">2. Skill Profile (Branching Questionnaire)</h3>

          {/* Section A - Batting */}
          <div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white">Do you consider yourself a skilled batter?</label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSkilledBatter(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${isSkilledBatter ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsSkilledBatter(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${!isSkilledBatter ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  No
                </button>
              </div>
            </div>

            {isSkilledBatter && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Batting Style</label>
                  <select
                    value={battingStyle}
                    onChange={(e) => setBattingStyle(e.target.value)}
                    className="w-full glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                  >
                    <option value="Aggressive batter">Aggressive batter</option>
                    <option value="Strike rotator">Strike rotator</option>
                    <option value="Big hitter">Big hitter</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Preferred Position</label>
                  <select
                    value={preferredBattingPos}
                    onChange={(e) => setPreferredBattingPos(e.target.value)}
                    className="w-full glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                  >
                    <option value="Opener">Opener</option>
                    <option value="Top order">Top order</option>
                    <option value="Middle order">Middle order</option>
                    <option value="Finisher">Finisher</option>
                  </select>
                </div>
              </div>
            )}
            <label className="block text-xs text-gray-300">Batting arm (asked of everyone)
              <select value={battingArm} onChange={(event) => setBattingArm(event.target.value)} className="mt-1 w-full glass-input rounded-xl p-2 text-xs bg-gray-900 text-white">
                <option value="Right">Right</option>
                <option value="Left">Left</option>
              </select>
            </label>
          </div>

          {/* Section B - Bowling */}
          <div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white">Do you consider yourself a skilled bowler?</label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSkilledBowler(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${isSkilledBowler ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsSkilledBowler(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${!isSkilledBowler ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  No
                </button>
              </div>
            </div>

            {isSkilledBowler && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Bowling Arm &amp; Type</label>
                  <div className="flex gap-2">
                    <select
                      value={bowlingArm}
                      onChange={(e) => setBowlingArm(e.target.value)}
                      className="w-1/2 glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                    >
                      <option value="Right">Right Arm</option>
                      <option value="Left">Left Arm</option>
                    </select>

                    <select
                      value={bowlingType}
                      onChange={(e) => setBowlingType(e.target.value)}
                      className="w-1/2 glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                    >
                      <option value="Fast">Fast</option>
                      <option value="Spin">Spin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Variety</label>
                  {bowlingType === 'Fast' ? (
                    <select
                      value={paceVariety}
                      onChange={(e) => setPaceVariety(e.target.value)}
                      className="w-full glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                    >
                      <option value="Express pace">Express pace</option>
                      <option value="Swing">Swing</option>
                      <option value="Seam">Seam</option>
                    </select>
                  ) : (
                    <select
                      value={spinVariety}
                      onChange={(e) => setSpinVariety(e.target.value)}
                      className="w-full glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                    >
                      <option value="Off-spin">Off-spin</option>
                      <option value="Leg-spin">Leg-spin</option>
                      <option value="Left-arm orthodox">Left-arm orthodox</option>
                      <option value="Left-arm wrist spin">Left-arm wrist spin</option>
                    </select>
                  )}
                </div>
              </div>
            )}
            {isSkilledBowler && (
              <fieldset className="space-y-2 pt-2">
                <legend className="text-xs text-gray-400">Bowling roles (select all that apply)</legend>
                <div className="grid grid-cols-2 gap-2">
                  {['Powerplay specialist', 'Economical bowler', 'Death-over specialist', 'Wicket-taking bowler'].map((role) => (
                    <label key={role} className="flex items-center gap-2 text-xs text-gray-300">
                      <input
                        type="checkbox"
                        checked={bowlingRoles.includes(role)}
                        onChange={(event) => setBowlingRoles((current) => event.target.checked ? [...current, role] : current.filter((value) => value !== role))}
                      />
                      {role}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          {/* Section C - Wicket-keeping */}
          <div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white">Are you a wicket-keeper?</label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsWicketKeeper(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${isWicketKeeper ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsWicketKeeper(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${!isWicketKeeper ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  No
                </button>
              </div>
            </div>
            {!isWicketKeeper && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-gray-400">Fielding zone
                  <select value={fieldingZone} onChange={(event) => setFieldingZone(event.target.value)} className="mt-1 w-full glass-input rounded-xl p-2 text-xs bg-gray-900 text-white">
                    <option value="Infield">Infield</option><option value="Outfield">Outfield</option>
                  </select>
                </label>
                <label className="text-xs text-gray-400">Preferred fielding position
                  <select value={preferredFieldingPos} onChange={(event) => setPreferredFieldingPos(event.target.value)} className="mt-1 w-full glass-input rounded-xl p-2 text-xs bg-gray-900 text-white">
                    {['Slip', 'Point', 'Cover', 'Mid-off', 'Mid-on', 'Mid-wicket', 'Square leg', 'Third man', 'Fine leg', 'Long-on', 'Long-off', 'Deep mid-wicket'].map((position) => <option key={position} value={position}>{position}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* Fielder Only Confirmation Rule */}
          {!isSkilledBatter && !isSkilledBowler && !isWicketKeeper && (
            <div className="bg-amber-950/60 border border-amber-500/50 p-4 rounded-2xl space-y-2">
              <p className="text-xs text-amber-300 font-bold">No cricketing skill claimed yet.</p>
              <label className="flex items-center space-x-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmFielderOnly}
                  onChange={(e) => setConfirmFielderOnly(e.target.checked)}
                  className="rounded bg-gray-900 border-gray-700"
                />
                <span>I explicitly confirm that I am registering as a Fielder only.</span>
              </label>
            </div>
          )}
        </div>

        <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-4">
          <h3 className="text-base font-bold text-white">3. Experience and self-declared career statistics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs text-gray-300">Highest level played
              <select value={highestLevelPlayed} onChange={(event) => setHighestLevelPlayed(event.target.value)} className="mt-1 w-full glass-input rounded-xl p-2.5 text-xs bg-gray-900 text-white">
                <option>District or above</option><option>Inter-college</option><option>School or intra-college</option><option>Recreational only</option>
              </select>
            </label>
            <label className="text-xs text-gray-300">Played in a previous ACC edition?
              <select value={playedAccBefore ? 'yes' : 'no'} onChange={(event) => setPlayedAccBefore(event.target.value === 'yes')} className="mt-1 w-full glass-input rounded-xl p-2.5 text-xs bg-gray-900 text-white">
                <option value="no">No</option><option value="yes">Yes</option>
              </select>
            </label>
            {playedAccBefore && (
              <label className="text-xs text-gray-300">Previous ACC team
                <input required value={previousAccTeam} onChange={(event) => setPreviousAccTeam(event.target.value)} className="mt-1 w-full glass-input rounded-xl p-2.5 text-xs" />
              </label>
            )}
          </div>
          <p className="text-[10px] text-amber-300">Career statistics are self-declared and should be checked against the linked CricHeroes profile.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Matches', matches, setMatches], ['Runs', runs, setRuns], ['Batting average', battingAvg, setBattingAvg],
              ['Strike rate', strikeRate, setStrikeRate], ['Highest score', highestScore, setHighestScore],
              ['Wickets', wickets, setWickets], ['Bowling average', bowlingAvg, setBowlingAvg],
              ['Economy', economy, setEconomy], ['Catches', catches, setCatches], ['Stumpings', stumpings, setStumpings],
            ].map(([label, value, setter]) => (
              <label key={String(label)} className="text-xs text-gray-300">{String(label)}
                <input type="number" min="0" step={String(label).includes('average') || String(label) === 'Strike rate' || String(label) === 'Economy' ? '0.01' : '1'} value={Number(value)} onChange={(event) => (setter as (value: number) => void)(Number(event.target.value))} className="mt-1 w-full glass-input rounded-xl p-2.5 text-xs" />
              </label>
            ))}
            <label className="text-xs text-gray-300">Best bowling
              <input value={bestBowling} onChange={(event) => setBestBowling(event.target.value)} className="mt-1 w-full glass-input rounded-xl p-2.5 text-xs" placeholder="e.g. 4/18" />
            </label>
          </div>
        </div>

        {/* ACC Reference Declaration (§5) */}
        {(parsedInfo?.show_acc_reference || (parsedInfo?.course === 'PG' && Number(pgAdmissionYear) === parsedInfo.current_academic_year)) && (
          <div className="glass-panel rounded-3xl p-6 border border-indigo-500/40 space-y-3">
            <h3 className="text-sm font-bold text-indigo-300">ACC Reference Program Declaration (§5)</h3>
            <label className="block text-xs text-gray-300">Did you join Avanthi through the ACC reference program?
              <select value={isAccReferred ? 'yes' : 'no'} onChange={(event) => setIsAccReferred(event.target.value === 'yes')} className="mt-1 w-full glass-input rounded-xl p-2.5 text-xs bg-gray-900 text-white">
                <option value="no">No</option><option value="yes">Yes</option>
              </select>
            </label>
            {isAccReferred && (
              <input required type="text" placeholder="Referring team name" value={referringTeamName} onChange={(event) => setReferringTeamName(event.target.value)} className="w-full glass-input rounded-xl p-3 text-xs" />
            )}
          </div>
        )}

        <button
          type="submit"
          className="w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-base rounded-2xl shadow-xl shadow-blue-500/25"
        >
          SUBMIT PLAYER REGISTRATION
        </button>
      </form>
    </div>
  );
};