import type { ReactNode } from "react";
import { privacyLinks } from "../lib/shared/privacy-links";

type FooterContact = {
  address: string;
  phone: string;
  tel: string;
  email: string;
};

const links = {
  home: "/",
  stay: "/prozhivanie",
  map: "/karta",
  booking: "/bronirovanie",
  contacts: "/kontakty",
  staff: "/admin/site/login",
};

export function GroveFooter({
  contact,
  bookReturn,
  staff = false,
}: {
  contact?: FooterContact;
  bookReturn?: ReactNode;
  staff?: boolean;
}) {
  return (
    <footer className="grove-footer">
      <div className="grove-footer-inner">
        <div>
          <a className="grove-footer-brand" href={links.home}>Рублевка</a>
          <p>Загородный комплекс в дубовой роще</p>
          {bookReturn}
        </div>
        <nav aria-label="Разделы в подвале">
          <p className="grove-footer-label">Ваш отдых</p>
          <a href={links.stay}>Проживание</a>
          <a href={links.map}>Карта комплекса</a>
          <a href={links.booking}>Выбрать даты</a>
        </nav>
        <address>
          <p className="grove-footer-label">Контакты</p>
          {contact && (
            <>
              <p>{contact.address}</p>
              <a href={contact.tel}>{contact.phone}</a>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </>
          )}
          <a href={links.contacts}>Как нас найти</a>
        </address>
      </div>
      <div className="grove-footer-base">
        <span>Загородный комплекс «Рублевка»</span>
        <span>Сайт разработал <a href="https://allqbit.ru/">allqbit.ru</a></span>
        {staff && <a href={links.staff}>Вход для сотрудников</a>}
        <div className="grove-footer-legal">
          {privacyLinks.map(({ href, label }) => (
            <a key={href} href={href}>{label}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}
