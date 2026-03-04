export interface User {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    group: string;
}

export const users: User[] = [
    {
        id: 1,
        email: 'raifhu@intelica.com',
        firstName: 'RAIF',
        lastName: 'HU',
        group: 'RAIFHU',
    },
    {
        id: 2,
        email: 'raifro@intelica.com',
        firstName: 'RAIF',
        lastName: 'RO',
        group: 'RAIFRO',
    },
    {
        id: 3,
        email: 'carlos.paucar@intelica.com',
        firstName: 'CARLOS',
        lastName: 'PAUCAR',
        group: 'Admin',
    },
    {
        id: 4,
        email: 'raifhu2@intelica.com',
        firstName: 'RAIF',
        lastName: 'HU2',
        group: 'RAIFHU2',
    },
    {
        id: 5,
        email: 'raifro2@intelica.com',
        firstName: 'RAIF',
        lastName: 'RO2',
        group: 'RAIFRO2',
    },
     {
        id: 6,
        email: 'sebastian.portal@intelica.com',
        firstName: 'Sebastian',
        lastName: 'Portal',
        group: 'SP',
    },
      {
        id: 7,
        email: 'mario.berghusen@intelica.com',
        firstName: 'Mario',
        lastName: 'Berghusen',
        group: 'MB',
    },
];
