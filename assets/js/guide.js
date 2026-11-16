import { SPLAT_RULES } from './rules.js';

const rows = (list, tag = 'td') => list.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
const items = (list) => list.map(([label, value, note]) =>
  `<li><strong>${label}:</strong> ${value}${note ? `<span class="guide-note">${note}</span>` : ''}</li>`).join('');

/** Renders the Creation & XP guide for one game line from rules.js. */
export function buildSplatGuideHTML(splat) {
  const r = SPLAT_RULES[splat];
  if (!r) return '';
  return `
    <h4>${r.creationTitle}</h4>
    <ul>${items(r.creation)}</ul>
    <h4>Key Traits</h4>
    <ul>${items(r.keyTraits)}</ul>
    <h4>${r.freebieTitle}</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>Cost</th></tr></thead>
      <tbody>${rows(r.freebie)}</tbody>
    </table>
    <h4>Experience Costs (XP)</h4>
    <table class="guide-cost-grid">
      <thead><tr><th>Trait</th><th>XP Cost</th></tr></thead>
      <tbody>${rows(r.xp)}</tbody>
    </table>${r.xpNote ? `
    <span class="guide-note">${r.xpNote}</span>` : ''}
    <h4>Specialties</h4>
    <p>${r.specialties}</p>
  `;
}

export const SPLAT_GUIDES = Object.fromEntries(Object.keys(SPLAT_RULES).map(k => [k, buildSplatGuideHTML(k)]));

export const DOT_SCALE_GUIDE_HTML = `
  <h4>Global Dot Rating Scale (0–5: Standard Scale)</h4>
  <table class="guide-scale-table">
    <thead><tr><th>Dots</th><th>Rating &amp; Meaning</th></tr></thead>
    <tbody>
      <tr>
        <td class="guide-scale-dots">0</td>
        <td><span class="guide-scale-rating">Untrained</span>Zero experience or conditioning; must rely on blind luck and cannot attempt specialized tasks.<span class="guide-scale-example">e.g., Someone who has never sat behind the wheel of a car.</span></td>
      </tr>
      <tr>
        <td class="guide-scale-dots">1</td>
        <td><span class="guide-scale-rating">Rookie</span>Basic familiarity; handles routine, low-stakes tasks fine but falters under real pressure.<span class="guide-scale-example">e.g., A weekend jogger, home cook, or first-month boxing student.</span></td>
      </tr>
      <tr>
        <td class="guide-scale-dots">2</td>
        <td><span class="guide-scale-rating">Seasoned</span>Solid, everyday proficiency; the healthy adult or working-professional standard.<span class="guide-scale-example">e.g., A patrol officer, auto mechanic, or regular gym-goer.</span></td>
      </tr>
      <tr>
        <td class="guide-scale-dots">3</td>
        <td><span class="guide-scale-rating">Veteran</span>Accomplished specialist tested under fire; respected in their field and able to train others.<span class="guide-scale-example">e.g., A SWAT operator, ER trauma surgeon, or regional amateur champ.</span></td>
      </tr>
      <tr>
        <td class="guide-scale-dots">4</td>
        <td><span class="guide-scale-rating">Elite</span>Standout, top-1% practitioner in a major city; reputation precedes them and shifts the odds of a scene.<span class="guide-scale-example">e.g., An Olympic qualifier, chief neurosurgeon, or top syndicate enforcer.</span></td>
      </tr>
      <tr>
        <td class="guide-scale-dots">5</td>
        <td><span class="guide-scale-rating">Apex</span>The ceiling of unaugmented mortal potential and the standard cap for starting supernatural characters; a once-in-a-generation prodigy.<span class="guide-scale-example">e.g., An Olympic gold medalist, Nikola Tesla, or Miyamoto Musashi.</span></td>
      </tr>
    </tbody>
  </table>

  <details id="guideElderScaleDetails" class="guide-elder-details">
    <summary class="guide-elder-summary">
      <span>6–10: Elder &amp; Mythic</span>
      <span id="guideElderBadge" class="guide-elder-badge">10-Dot Mode Off</span>
    </summary>
    <div class="guide-elder-body">
      <p class="guide-scale-intro">Both mortals and standard supernatural characters hard-cap at <strong>5 dots</strong>; ratings from <strong>6–10</strong> only unlock in <strong>10-Dot Mode</strong> for ancient Elders (7th Gen or lower), high-rank shifters, archmages, and mythic beings.</p>
      <table class="guide-scale-table">
        <thead><tr><th>Dots</th><th>Rating &amp; Meaning</th></tr></thead>
        <tbody>
          <tr>
            <td class="guide-scale-dots">6</td>
            <td><span class="guide-scale-rating">Preternatural</span>Visibly surpasses human limits; impossible without ancient blood, deep spiritual might, or Awakened mastery.<span class="guide-scale-example">e.g., A mythic hero bending iron bars barehanded.</span></td>
          </tr>
          <tr>
            <td class="guide-scale-dots">7</td>
            <td><span class="guide-scale-rating">Mythic</span>A force of nature whose feats defy mundane physics or historical records.<span class="guide-scale-example">e.g., Hercules wrestling monstrous beasts.</span></td>
          </tr>
          <tr>
            <td class="guide-scale-dots">8</td>
            <td><span class="guide-scale-rating">Legendary</span>Near-unstoppable within their domain; whispered of across entire factions or centuries.<span class="guide-scale-example">e.g., Achilles turning the tide of an entire war single-handedly.</span></td>
          </tr>
          <tr>
            <td class="guide-scale-dots">9</td>
            <td><span class="guide-scale-rating">Incarnate</span>A walking embodiment of the trait itself; ordinary characters cannot meaningfully contest this rating.<span class="guide-scale-example">e.g., Sun Wukong or mythic Thor shattering mountains.</span></td>
          </tr>
          <tr>
            <td class="guide-scale-dots">10</td>
            <td><span class="guide-scale-rating">Primordial</span>Plot-device tier; reality bends around the sheer weight of this trait.<span class="guide-scale-example">e.g., Odin or Zeus—narrative forces where rolling dice is a formality.</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
`;
