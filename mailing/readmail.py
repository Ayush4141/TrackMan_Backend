import imaplib
import email
from email.header import decode_header
import os
import requests
import os
import smtplib
from dotenv import load_dotenv
load_dotenv()

username = os.getenv('EMAILID')
password = os.getenv('EMAIL_PASSWORD')
secret_key = os.getenv('RECEIVE_EMAIL_SECRET_KEY')

def extractTeachersEmail(From):
    index1 = From.find('<')
    index2 = From.find('>')
    if index1 == -1 or index2 == -1:
        sendErrorMail("Error in parsing teachers email", "Error occured")
        return "Error"
    return From[index1+1:index2]

def sendPOSTRequest(filepath, teacherEmail):
    url = 'http://localhost:4000/api/uploadFiles/readForwardedMails'
    data = {'filepath': filepath,
            'teacherEmail': teacherEmail, 'APIKEY': secret_key}
    res = requests.post(url, data=data)
    if(res.status_code == 400):
        sendErrorMail("Error In Route", res.text)
        return
    print(res.text)

def sendErrorMail(subject, message):
    li = ["garg.10@iitj.ac.in"]
    s = smtplib.SMTP('smtp.gmail.com', 587)
    s.starttls()
    s.login(os.getenv('EMAILID'), os.getenv('EMAIL_PASSWORD'))
    message = 'Subject: {}\n\n{}'.format(subject, message)
    for dest in li:
        s.sendmail(os.getenv('EMAILID'), dest, message)
        print("Error mail sent succesfully!!!")
    s.quit()

def readMail(imap, lst, i):
    latest_email_uid = lst[i]
    res, msg = imap.uid('fetch', latest_email_uid, '(RFC822)')
    for response in msg:
        if isinstance(response, tuple):
            msg = email.message_from_bytes(response[1])
            subject, encoding = decode_header(msg["Subject"])[0]
            if isinstance(subject, bytes):

                subject = subject.decode(encoding)

            From, encoding = decode_header(msg.get("From"))[0]
            if isinstance(From, bytes):
                From = From.decode(encoding)
            # print("Subject:", subject)
            # print("From:", From)

            if msg.is_multipart():

                for part in msg.walk():

                    content_type = part.get_content_type()
                    content_disposition = str(
                        part.get("Content-Disposition"))
                    try:
                        body = part.get_payload(decode=True).decode()
                    except Exception as e:
                        print(e)
                    if content_type == "text/plain" and "attachment" not in content_disposition:
                        pass
                        # print(body)
                    elif "attachment" in content_disposition:
                        filename = part.get_filename()
                        updatedFilename = filename.replace(":", "_", 1)
                        if filename:
                            try:
                                folder_name = os.getenv('FOLDER_PATH')
                                filepath = os.path.join(
                                    folder_name, updatedFilename)
                                open(filepath, "wb").write(
                                    part.get_payload(decode=True))
                            except Exception as e:
                                sendErrorMail("Error In Downloading CSV File", e)
                                continue
                            
                            if(extractTeachersEmail(From) == "Error"):
                                continue
                            else:
                                sendPOSTRequest(
                                    filename, extractTeachersEmail(From))

            print("="*100)

if __name__ == "__main__":
    try:
        imap = imaplib.IMAP4_SSL("imap.gmail.com")
        imap.login(username, password)
        imap.list()
        imap.select("inbox")
        retcode, messages = imap.uid('search', None, "UNSEEN")
        N = len(messages[0].split())
        lst = []
        for i in range(N):
            lst.append(messages[0].split()[i])

        for i in range(0, len(lst)):
            # fetch the email message by ID
            readMail(imap, lst, i)
        imap.close()
        imap.logout()
    except Exception as e:
        sendErrorMail("Error Connecting IMAP", e)
