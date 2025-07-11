let airlinesData = {};

// Load the airlines JSON file when the page loads
async function loadAirlinesData() {
    try {
        const response = await fetch('/airlines.json');
        if (!response.ok) {
            throw new Error(`Failed to load airlines data: ${response.statusText}`);
        }
        const data = await response.json();

        // Normalize the ICAO keys and create a dictionary
        airlinesData = data.reduce((acc, entry) => {
            const normalizedICAO = entry.ICAO.trim().toUpperCase();
            acc[normalizedICAO] = entry.Airline.trim();
            return acc;
        }, {});
    } catch (error) {
        console.error('Error loading airlines data:', error);
        alert('Failed to load airline data. Please try again later.');
    }
}

// Call the function to load airlines data
loadAirlinesData();
document.getElementById('getLocation').addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            sessionStorage.setItem('lat', lat);
            sessionStorage.setItem('lon', lon);

            const locationDisplay = document.createElement('p');
            locationDisplay.textContent = `Location: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
            locationDisplay.id = 'myLocation';

            const googleMapsLink = document.createElement('a');
            googleMapsLink.href = `https://www.google.com/maps/search/${lat.toFixed(6)},+${lon.toFixed(6)}`;
            googleMapsLink.textContent = 'See on Google Maps';
            googleMapsLink.target = '_blank';
            googleMapsLink.id = 'googleMapsLink';

            const controlsDiv = document.getElementById('controls');
            const existingLocation = document.getElementById('myLocation');
            const existingLink = document.getElementById('googleMapsLink');

            if (existingLocation) {
                existingLocation.textContent = `Location: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                if (existingLink) {
                    existingLink.href = `https://www.google.com/maps/search/${lat.toFixed(6)},+${lon.toFixed(6)}`;
                } else {
                    controlsDiv.appendChild(googleMapsLink);
                }
            } else {
                controlsDiv.appendChild(locationDisplay);
                controlsDiv.appendChild(googleMapsLink);
            }
        }, (error) => {
            const errorMessage = {
                1: 'Permission denied. Please allow location access.',
                2: 'Position unavailable. Please try again.',
                3: 'Request timed out. Please refresh and try again.'
            };
            alert(errorMessage[error.code] || 'An unknown error occurred.');
        });
    } else {
        alert('Geolocation is not supported by your browser.');
    }
});

document.getElementById('fetchData').addEventListener('click', async () => {
    const lat = sessionStorage.getItem('lat');
    const lon = sessionStorage.getItem('lon');
    const radius = document.getElementById('radius').value;

    if (!lat || !lon) {
        alert('Please click "Get My Location" first.');
        return;
    }

    const planeDataElement = document.getElementById('planeData');
    planeDataElement.textContent = "Fetching plane data...";

    try {
        const response = await fetch(`https://planesnear.me/planes?lat=${lat}&lon=${lon}&dist=${radius}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error: ${response.status}. ${errorText}`);
        }

        const data = await response.json();

        if (!data.ac || data.ac.length === 0) {
            planeDataElement.innerHTML = "<p>No planes found within the specified radius. Try making the radius bigger.</p>";
        } else {
            const airbornePlanes = data.ac.filter(plane => plane.alt_baro !== "ground");
            if (airbornePlanes.length === 0) {
                planeDataElement.innerHTML = "<p>No airborne planes found within the specified radius.</p>";
            } else {
                displayPlanes(airbornePlanes);
            }
        }
    } catch (error) {
        alert(`Failed to fetch data: ${error.message}`);
        console.error(error);
        planeDataElement.textContent = "An error occurred while fetching data.";
    }
});

function displayPlanes(planes) {
    const planeDataElement = document.getElementById('planeData');
    planeDataElement.innerHTML = ''; // Clear previous content

    // Sort planes by distance, closest first
    planes.sort((a, b) => (a.dist || 0) - (b.dist || 0));

    planes.forEach(plane => {
        const flight = plane.flight || "Unknown";
        const icaoCode = flight.slice(0, 3).toUpperCase();
        const airline = airlinesData[icaoCode] || "Unknown";
        const altitude = plane.alt_baro
            ? `${new Intl.NumberFormat().format(plane.alt_baro)} ft`
            : "Unknown";
        const distance = plane.dist ? `${plane.dist.toFixed(1)} nm` : "Unknown";
        const flightAwareLink = flight !== "Unknown" ? `https://www.flightaware.com/live/flight/${flight}` : "#";
        const flightradarLink = flight !== "Unknown" ? `https://www.flightradar24.com/${flight}` : "#";

        const cardHTML = `
            <div class="plane-card">
                <div class="plane-card-header">
                    <span>${airline} - ${flight}</span>
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="plane-card-content">
                    <p><strong>Airline:</strong> ${airline}</p>
                    <p><strong>Flight:</strong> ${flight}</p>
                    <p><strong>Altitude:</strong> ${altitude}</p>
                    <p><strong>Distance:</strong> ${distance}</p>
                    <p><a href="${flightAwareLink}" target="_blank">FlightAware</a> | <a href="${flightradarLink}" target="_blank">Flightradar24</a>
                    </p>
                </div>
            </div>
        `;

        planeDataElement.insertAdjacentHTML('beforeend', cardHTML);
    });

    // Add toggle functionality for collapsible cards
    document.querySelectorAll('.plane-card').forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('open');
        });
    });
}