/** Synthetic protocol fixture only — not a real location or live availability. */
export const examplePoint = {
  ID: 12345,
  AddressInfo: {
    Title: "Example external hub",
    AddressLine1: "Example Road",
    Town: "Marlow",
    Postcode: "SL7 TEST",
    Latitude: 51.57,
    Longitude: -0.78,
  },
  OperatorInfo: {
    ID: 3,
    Title: "Example network",
    WebsiteURL: "https://example.com",
  },
  UsageType: { ID: 1, Title: "Public - Pay At Location" },
  StatusType: { ID: 50, IsOperational: true, Title: "Operational" },
  NumberOfPoints: 4,
  Connections: [
    {
      ID: 1,
      ConnectionTypeID: 33,
      ConnectionType: { ID: 33, Title: "CCS (Type 2)" },
      PowerKW: 150,
      Quantity: 4,
    },
    {
      ID: 2,
      ConnectionType: { ID: 25, Title: "Type 2" },
      PowerKW: 22,
      Quantity: 2,
    },
  ],
  UsageCost: "70p/kWh, parking charges may apply",
  DataProvider: {
    IsOpenDataLicensed: true,
    IsApprovedImport: true,
    Title: "Example open data contributor",
    License: "Example test licence",
  },
  DateLastVerified: "2026-09-25T12:00:00Z",
  DateLastStatusUpdate: "2026-09-25T12:00:00Z",
};
